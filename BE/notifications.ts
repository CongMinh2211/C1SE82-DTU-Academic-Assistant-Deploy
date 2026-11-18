// Cài đặt email riêng theo tài khoản và gửi thông báo phản hồi qua worker hiện có.
import { db, row, now, id, audit } from "./db";
import { HttpError } from "./http";
import { appUrl } from "./config";
import { feedbackResolvedMessage, mailConfig, sendMail } from "./mail";

// Vercel chưa có consumer hàng đợi email; chỉ bật nơi có worker chạy nền.
export function feedbackEmailAvailable() { return !process.env.VERCEL && !!mailConfig(); }

export async function notificationPreferences(userId: string) {
  const saved = await row<{ feedback_email: number }>(
    "SELECT feedback_email FROM user_notification_preferences WHERE user_id=?", userId,
  );
  return { feedback_email: saved?.feedback_email === 1, email_available: feedbackEmailAvailable() };
}

export async function saveNotificationPreferences(userId: string, feedbackEmail: boolean) {
  if (feedbackEmail && !feedbackEmailAvailable())
    throw new HttpError(503, "Dịch vụ email chưa sẵn sàng. Vui lòng thử lại sau.");
  await db().transaction(async () => {
    await db().prepare("INSERT INTO user_notification_preferences(user_id,feedback_email,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET feedback_email=excluded.feedback_email,updated_at=excluded.updated_at")
      .run(userId, feedbackEmail ? 1 : 0, now());
    // Không phát lại thông báo cũ nếu người dùng tắt rồi bật lại.
    if (!feedbackEmail)
      await db().prepare("UPDATE feedback_email_queue SET status='cancelled',lease_until=NULL,claim_token=NULL WHERE user_id=? AND status IN ('queued','sending')").run(userId);
  })();
  return notificationPreferences(userId);
}

export async function resolveFeedback(feedbackId: string, actorId: string, resolution: string) {
  await db().transaction(async () => {
    const changed = await db().prepare("UPDATE feedback SET status='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND status='pending'")
      .run(resolution, actorId, now(), feedbackId);
    if (!changed.changes) throw new HttpError(409, "Phản hồi không còn chờ xử lý.");
    // Ghi cùng giao dịch để email không bị bỏ sót nếu tiến trình dừng sau khi xử lý góp ý.
    await db().prepare("INSERT INTO feedback_email_queue(feedback_id,user_id,next_attempt_at,created_at) SELECT f.id,f.user_id,?,? FROM feedback f JOIN user_notification_preferences p ON p.user_id=f.user_id WHERE f.id=? AND p.feedback_email=1 ON CONFLICT(feedback_id) DO NOTHING")
      .run(Date.now(), now(), feedbackId);
    await audit(actorId, "feedback.resolved", feedbackId);
  })();
  return { ok: true };
}

type Delivery = { feedback_id: string; user_id: string; attempts: number; claim_token: string };

/** Một lượt worker xử lý tối đa một thư; SMTP lỗi không làm mất kết quả giải quyết góp ý. */
export async function sendNextFeedbackNotification() {
  if (!feedbackEmailAvailable()) return false;
  const time = Date.now();
  const job = await db().transaction(async () => {
    await db().prepare("UPDATE feedback_email_queue SET status='failed',claim_token=NULL,lease_until=NULL WHERE status='sending' AND lease_until<=? AND attempts>=3").run(time);
    const queued = await row<{ feedback_id: string; user_id: string; attempts: number }>(
      "SELECT feedback_id,user_id,attempts FROM feedback_email_queue WHERE attempts<3 AND ((status='queued' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?)) ORDER BY created_at,feedback_id LIMIT 1", time, time,
    );
    if (!queued) return null;
    const claim = id();
    await db().prepare("UPDATE feedback_email_queue SET status='sending',attempts=attempts+1,lease_until=?,claim_token=? WHERE feedback_id=?")
      .run(time + 120000, claim, queued.feedback_id);
    return { ...queued, attempts: queued.attempts + 1, claim_token: claim } as Delivery;
  })();
  if (!job) return false;
  try {
    // Kiểm tra lại lựa chọn và quyền nhận ngay trước gửi, chỉ đọc email từ tài khoản sở hữu.
    const recipient = await row<{ email: string; banned: boolean | number | null }>(
      "SELECT u.email,u.banned FROM feedback_email_queue q JOIN user u ON u.id=q.user_id JOIN user_notification_preferences p ON p.user_id=q.user_id JOIN feedback f ON f.id=q.feedback_id WHERE q.feedback_id=? AND q.claim_token=? AND q.status='sending' AND p.feedback_email=1 AND f.status='resolved' AND f.user_id=q.user_id",
      job.feedback_id, job.claim_token,
    );
    if (!recipient || recipient.banned) {
      await db().prepare("UPDATE feedback_email_queue SET status='cancelled',lease_until=NULL,claim_token=NULL WHERE feedback_id=? AND claim_token=?")
        .run(job.feedback_id, job.claim_token);
      return true;
    }
    const link = new URL("/sinh-vien/gop-y", appUrl);
    link.searchParams.set("feedback", job.feedback_id);
    await sendMail(feedbackResolvedMessage(recipient.email, link.href));
    await db().prepare("UPDATE feedback_email_queue SET status='sent',sent_at=?,lease_until=NULL,claim_token=NULL WHERE feedback_id=? AND claim_token=?")
      .run(now(), job.feedback_id, job.claim_token);
  } catch {
    // Chỉ giữ trạng thái và số lần thử, không lưu nội dung lỗi SMTP/địa chỉ email vào log.
    await db().prepare("UPDATE feedback_email_queue SET status=?,next_attempt_at=?,lease_until=NULL,claim_token=NULL WHERE feedback_id=? AND claim_token=?")
      .run(job.attempts >= 3 ? "failed" : "queued", Date.now() + 60000 * 2 ** (job.attempts - 1), job.feedback_id, job.claim_token);
  }
  // SMTP không có xác nhận idempotency: crash sau khi máy chủ nhận thư có thể gửi lặp khi thử lại.
  return true;
}

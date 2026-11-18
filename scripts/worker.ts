import { sendNextFeedbackNotification } from "../BE/notifications";
import { runScheduledCrawl } from "../BE/crawler";
import { runNextJob } from "../BE/knowledge";
import { db, now } from "../BE/db";
import { setTimeout } from "node:timers/promises";
import { purgeExpiredConversations } from "../BE/conversations";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const once = process.argv.includes("--once");
let nextTrashPurge = 0;
let nextCrawlCheck = 0;
do {
  // Mỗi giờ dọn theo lô, không để lỗi dọn rác làm dừng worker lập chỉ mục.
  if (Date.now() >= nextTrashPurge) {
    try {
      const count = await purgeExpiredConversations();
      nextTrashPurge = Date.now() + (count === 100 ? 3000 : 3600000);
    } catch {
      console.error("Không thể dọn hội thoại quá hạn; sẽ thử lại.");
      nextTrashPurge = Date.now() + 60000;
    }
  }
  await db()
    .prepare("DELETE FROM rate_limits WHERE expires_at<?")
    .run(Date.now());
  await db()
    .prepare(
      "UPDATE messages SET status='error',content='Yêu cầu bị gián đoạn. Bạn có thể gửi lại câu hỏi.' WHERE role='assistant' AND status='processing' AND created_at<? AND conversation_id IN (SELECT c.id FROM conversations c WHERE NOT EXISTS(SELECT 1 FROM chat_leases l WHERE l.user_id=c.user_id AND l.expires_at>?))",
    )
    .run(new Date(Date.now() - 180000).toISOString(), Date.now());
  await db()
    .prepare(
      "UPDATE traces SET status='error',reason='interrupted' WHERE status='processing' AND id IN (SELECT trace_id FROM messages WHERE status='error')",
    )
    .run();
  if (Date.now() >= nextCrawlCheck) {
    try { await runScheduledCrawl(); } catch { console.error("Không thể kiểm tra lịch thu thập nguồn."); }
    nextCrawlCheck = Date.now() + 60000;
  }
  try { await sendNextFeedbackNotification(); } catch { console.error("Không thể xử lý email phản hồi; worker sẽ thử lại."); }
  const worked = await runNextJob();
  await db()
    .prepare(
      "INSERT INTO rate_limits VALUES ('worker:heartbeat',1,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at",
    )
    .run(Date.now() + 60000);
  if (!worked) {
    if (once) break;
    await setTimeout(3000);
  }
} while (!stopping);
console.log(JSON.stringify({ event: "worker_stopped", at: now() }));

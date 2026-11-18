// Phiên thật + CSDL tạm + SMTP giả; không gửi thư hoặc đọc dữ liệu thật.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import { getMigrations } from "better-auth/db/migration";

const directory = await mkdtemp(path.join(tmpdir(), "dtu-notifications-"));
process.env.APP_DATA_DIR = directory;
process.env.DATABASE_URL = "";
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.BETTER_AUTH_SECRET = "test-secret-only-1234567890123456789012345";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.EMAIL_OTP_ENABLED = "false";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_USER = "sender@example.test";
process.env.SMTP_PASSWORD = "test-only";
process.env.SMTP_FROM = "sender@example.test";
let failMail = false;
let delivered: { to: string; text: string; html: string }[] = [];
let deliveriesStarted = 0;
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = (() => ({
  async sendMail(mail: typeof delivered[number]) {
    deliveriesStarted++;
    if (failMail) throw new Error("private smtp error must not escape");
    delivered.push(mail);
  }, close() {},
})) as unknown as typeof nodemailer.createTransport;

const { getAuth } = await import("../auth");
const { db, row, id, now } = await import("../db");
const { feedbackEmailAvailable, notificationPreferences, saveNotificationPreferences, resolveFeedback, sendNextFeedbackNotification } = await import("../notifications");
const { getResource } = await import("../api/get");
const { patchResource } = await import("../api/patch");
const { postResource } = await import("../api/post");
const { feedbackResolvedMessage } = await import("../mail");
const auth = getAuth();
await (await getMigrations(auth.options)).runMigrations();
const password = "test-password-123456";
async function account(email: string, role = "user") {
  const value = await auth.api.signUpEmail({ body: { email, password, name: "Test account" } });
  await db().prepare("UPDATE user SET role=? WHERE id=?").run(role, value.user.id);
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookie = response.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
  return { id: value.user.id, email, cookie };
}
const first = await account("first@example.test");
const second = await account("second@example.test");
const admin = await account("admin@example.test", "admin");
function request(resource: string, method = "GET", cookie = first.cookie, body?: object, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/app/${resource}`, { method, headers: { cookie, origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function status(code: number) { return (e: unknown) => (e as { status?: number }).status === code; }
async function feedback(owner = first.id) {
  const key = id();
  await db().prepare("INSERT INTO feedback(id,user_id,rating,category,content,created_at) VALUES(?,?,?,?,?,?)")
    .run(key, owner, 4, "Test", "Nội dung riêng không được gửi email", now());
  return key;
}
test.beforeEach(async () => {
  await db().prepare("DELETE FROM feedback_email_queue").run();
  await db().prepare("DELETE FROM feedback").run();
  await db().prepare("DELETE FROM user_notification_preferences").run();
  delivered = []; deliveriesStarted = 0; failMail = false;
  process.env.SMTP_HOST = "smtp.example.test";
});

test("API mặc định tắt, lưu riêng từng tài khoản và từ chối dữ liệu giả mạo", async () => {
  assert.deepEqual(await getResource(request("notification-preferences")), { feedback_email: false, email_available: true });
  assert.deepEqual(await patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: true })), { feedback_email: true, email_available: true });
  assert.equal((await notificationPreferences(first.id)).feedback_email, true);
  assert.equal((await notificationPreferences(second.id)).feedback_email, false);
  await assert.rejects(patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: "false" })), status(400));
  await assert.rejects(patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: true, user_id: second.id })), status(400));
  await assert.rejects(getResource(request("notification-preferences", "GET", "")), status(401));
  await assert.rejects(patchResource(request("notification-preferences", "PATCH", "", { feedback_email: true })), status(401));
  await assert.rejects(patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: true }, "https://other.example.test")), status(403));
});

test("Vercel chưa có worker: SMTP đủ vẫn không cho bật hoặc chạy gửi", async () => {
  const previous=process.env.VERCEL;
  process.env.VERCEL="1";
  try {
    assert.equal(feedbackEmailAvailable(),false);
    await assert.rejects(saveNotificationPreferences(first.id,true),status(503));
    assert.equal(await sendNextFeedbackNotification(),false);
    assert.equal(deliveriesStarted,0);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL=previous;
  }
  assert.equal((await notificationPreferences(first.id)).feedback_email,false);
});

test("SMTP chưa cấu hình: báo không khả dụng, vẫn cho tắt và không mất kết quả phản hồi", async () => {
  await saveNotificationPreferences(first.id, true);
  delete process.env.SMTP_HOST;
  assert.deepEqual(await notificationPreferences(first.id), { feedback_email: true, email_available: false });
  await assert.rejects(patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: true })), status(503));
  const key = await feedback();
  await resolveFeedback(key, admin.id, "Kết quả đã được lưu");
  assert.equal(await sendNextFeedbackNotification(), false);
  assert.equal((await row<{ attempts: number }>("SELECT attempts FROM feedback_email_queue WHERE feedback_id=?", key))?.attempts, 0);
  await patchResource(request("notification-preferences", "PATCH", first.cookie, { feedback_email: false }));
  assert.equal(deliveriesStarted, 0);
  assert.equal((await row<{ status: string }>("SELECT status FROM feedback WHERE id=?", key))?.status, "resolved");
});

test("admin xử lý tạo đúng một email; owner xem chi tiết, người khác bị chặn", async () => {
  await saveNotificationPreferences(first.id, true);
  const key = await feedback();
  await assert.rejects(postResource(request(`admin/feedback/${key}`, "POST", first.cookie, { resolution: "Xử lý không được phép" })), status(403));
  await postResource(request(`admin/feedback/${key}`, "POST", admin.cookie, { resolution: "Kết quả riêng không đưa vào email" }));
  await assert.rejects(postResource(request(`admin/feedback/${key}`, "POST", admin.cookie, { resolution: "Thử giải quyết lần hai" })), status(409));
  assert.equal((await getResource(request(`feedback/${key}`)) as {id:string}).id, key);
  await assert.rejects(getResource(request(`feedback/${key}`, "GET", second.cookie)), status(404));
  await assert.rejects(getResource(request(`feedback/${key}`, "GET", "")), status(401));
  const outcomes = await Promise.all([sendNextFeedbackNotification(), sendNextFeedbackNotification()]);
  assert.deepEqual(outcomes.sort(), [false, true]);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].to, first.email);
  assert.ok(delivered[0].text.includes(`http://localhost:3000/sinh-vien/gop-y?feedback=${key}`));
  assert.ok(!delivered[0].text.includes("Kết quả riêng"));
  assert.ok(!delivered[0].html.includes("Nội dung riêng"));
  assert.equal((await row<{status:string}>("SELECT status FROM feedback_email_queue WHERE feedback_id=?",key))?.status,"sent");
});

test("mặc định không gửi và tắt sau khi xếp hàng hủy thư kể cả bật lại", async () => {
  const off = await feedback();
  await resolveFeedback(off, admin.id, "Đã xử lý trường hợp mặc định");
  assert.equal(await row("SELECT feedback_id FROM feedback_email_queue WHERE feedback_id=?", off), undefined);
  await saveNotificationPreferences(first.id, true);
  const key = await feedback();
  await resolveFeedback(key, admin.id, "Đã xử lý trước khi tắt");
  await saveNotificationPreferences(first.id, false);
  await saveNotificationPreferences(first.id, true);
  assert.equal(await sendNextFeedbackNotification(), false);
  assert.equal(deliveriesStarted, 0);
  assert.equal((await row<{status:string}>("SELECT status FROM feedback_email_queue WHERE feedback_id=?",key))?.status,"cancelled");
});

test("lỗi SMTP thử tối đa ba lần và không đảo ngược trạng thái đã xử lý", async () => {
  await saveNotificationPreferences(first.id, true);
  const key = await feedback();
  await resolveFeedback(key, admin.id, "Đã xử lý dù email lỗi");
  failMail = true;
  for (let attempt = 1; attempt <= 3; attempt++) {
    assert.equal(await sendNextFeedbackNotification(), true);
    const queued = await row<{status:string;attempts:number}>("SELECT status,attempts FROM feedback_email_queue WHERE feedback_id=?",key);
    assert.equal(queued?.attempts, attempt);
    assert.equal(queued?.status, attempt === 3 ? "failed" : "queued");
    if (attempt < 3) {
      assert.equal(await sendNextFeedbackNotification(),false);
      await db().prepare("UPDATE feedback_email_queue SET next_attempt_at=0 WHERE feedback_id=?").run(key);
    }
  }
  assert.equal(await sendNextFeedbackNotification(), false);
  assert.equal(deliveriesStarted, 3);
  assert.equal((await row<{status:string}>("SELECT status FROM feedback WHERE id=?",key))?.status,"resolved");
});

test("khôi phục job hết lease nhưng không gửi job đang có worker khác", async () => {
  await saveNotificationPreferences(first.id,true);
  const key=await feedback();
  await resolveFeedback(key,admin.id,"Đã xử lý để kiểm lease");
  await db().prepare("UPDATE feedback_email_queue SET status='sending',attempts=1,claim_token='old',lease_until=? WHERE feedback_id=?").run(Date.now()+60000,key);
  assert.equal(await sendNextFeedbackNotification(),false);
  await db().prepare("UPDATE feedback_email_queue SET lease_until=0 WHERE feedback_id=?").run(key);
  assert.equal(await sendNextFeedbackNotification(),true);
  assert.equal(delivered.length,1);
});

test("giao dịch hoàn tác kết quả và hàng đợi nếu ghi audit thất bại", async () => {
  await saveNotificationPreferences(first.id,true);
  const key=await feedback();
  const {db: localDb}=await import("../sqlite");
  localDb().exec("CREATE TRIGGER fail_feedback_audit BEFORE INSERT ON audit WHEN NEW.action='feedback.resolved' BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try {
    await assert.rejects(resolveFeedback(key,admin.id,"Kết quả phải hoàn tác"));
    assert.equal((await row<{status:string}>("SELECT status FROM feedback WHERE id=?",key))?.status,"pending");
    assert.equal(await row("SELECT feedback_id FROM feedback_email_queue WHERE feedback_id=?",key),undefined);
  } finally { localDb().exec("DROP TRIGGER fail_feedback_audit"); }
});

test("kiểm tra lại tài khoản bị khóa trước khi gửi thư đang chờ", async () => {
  await saveNotificationPreferences(first.id,true);
  const key=await feedback();
  await resolveFeedback(key,admin.id,"Đã xử lý trước khi khóa");
  await db().prepare("UPDATE user SET banned=1 WHERE id=?").run(first.id);
  try {
    assert.equal(await sendNextFeedbackNotification(),true);
    assert.equal(deliveriesStarted,0);
    assert.equal((await row<{status:string}>("SELECT status FROM feedback_email_queue WHERE feedback_id=?",key))?.status,"cancelled");
  } finally { await db().prepare("UPDATE user SET banned=0 WHERE id=?").run(first.id); }
});

test("mẫu email escape URL và từ chối giao thức không an toàn", () => {
  const mail=feedbackResolvedMessage(first.email,'https://example.test/sinh-vien/gop-y?feedback=a&x="value"');
  assert.match(mail.html,/&amp;x=&quot;value&quot;/);
  assert.throws(()=>feedbackResolvedMessage(first.email,"javascript:alert(1)"));
});

test.after(async () => {
  nodemailer.createTransport=originalTransport;
  await db().close();
  await rm(directory,{recursive:true,force:true});
});

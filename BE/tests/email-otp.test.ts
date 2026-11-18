// Kiểm thử OTP với CSDL tạm và SMTP giả; không gửi email ra Internet.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import { getMigrations } from "better-auth/db/migration";

const dir = await mkdtemp(path.join(tmpdir(), "dtu-otp-test-"));
process.env.APP_DATA_DIR = dir;
process.env.BETTER_AUTH_SECRET = "test-secret-please-use-32-bytes-minimum-123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.EMAIL_OTP_ENABLED = "true";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_USER = "sender@example.test";
process.env.SMTP_PASSWORD = "test-only";
let lastText = "";
const originalTransport = nodemailer.createTransport;
// Giữ nội dung thư trong bộ nhớ để lấy OTP, không ghi mã ra log.
nodemailer.createTransport = (() => ({ sendMail: async (mail: { text: string }) => { lastText = mail.text; }, close() {} })) as unknown as typeof nodemailer.createTransport;
const { getAuth } = await import("../../BE/auth");
const auth = getAuth();
await (await getMigrations(auth.options)).runMigrations();
const email = "student@example.test", password = "long-test-password-123";
const currentOtp = () => { const match = lastText.match(/\b\d{6}\b/); assert.ok(match); return match[0]; };
test("đăng ký không gửi email xác minh và cho phép đăng nhập", async () => {
  await auth.api.signUpEmail({ body: { name: "Sinh viên test", email, password } });
  assert.equal(lastText, "");
  assert.ok((await auth.api.signInEmail({ body: { email, password } })).user);
});
test("không mở API gửi mã xác minh email", async () => {
  const response = await auth.handler(new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {method:"POST", headers:{"Content-Type":"application/json", Origin:"http://localhost:3000"}, body:JSON.stringify({email,type:"email-verification"})}));
  assert.equal(response.status, 404);
  assert.equal(lastText, "");
});
test("đặt lại mật khẩu cần OTP và mã không dùng lại được", async () => {
  await auth.api.requestPasswordResetEmailOTP({ body: { email } });
  const otp = currentOtp();
  const check = (code: string) => auth.handler(new Request("http://localhost:3000/api/auth/email-otp/check-verification-otp", {method:"POST", headers:{"Content-Type":"application/json", Origin:"http://localhost:3000"}, body:JSON.stringify({email,type:"forget-password",otp:code})}));
  assert.notEqual((await check(otp === "000000" ? "000001" : "000000")).status, 200);
  assert.equal((await check(otp)).status, 200);
  // Xác minh bước đầu không tiêu thụ mã; bước đổi mật khẩu kiểm tra lại rồi mới tiêu thụ.
  await auth.api.resetPasswordEmailOTP({ body: { email, otp, password: "new-long-password-123" } });
  assert.notEqual((await check(otp)).status, 200);
  await assert.rejects(auth.api.resetPasswordEmailOTP({ body: { email, otp, password: "other-long-password-123" } }));
  assert.ok((await auth.api.signInEmail({ body: { email, password: "new-long-password-123" } })).user);
});
test("mã hết hạn và quá số lần nhập sai đều bị từ chối", async () => {
  await auth.api.requestPasswordResetEmailOTP({ body: { email } });
  let otp = currentOtp();
  const { db } = await import("../../BE/db");
  // Chỉnh thời gian hết hạn chỉ trong CSDL thử nghiệm để mô phỏng mã quá 5 phút.
  await db().prepare("UPDATE verification SET expiresAt=? WHERE identifier=?").run(0, `forget-password-otp-${email}`);
  await assert.rejects(auth.api.resetPasswordEmailOTP({ body: { email, otp, password: "other-long-password-123" } }));
  await auth.api.requestPasswordResetEmailOTP({ body: { email } });
  otp = currentOtp();
  const bad = otp === "000000" ? "000001" : "000000";
  for (let i = 0; i < 3; i++) await assert.rejects(auth.api.resetPasswordEmailOTP({ body: { email, otp: bad, password: "other-long-password-123" } }));
  await assert.rejects(auth.api.resetPasswordEmailOTP({ body: { email, otp, password: "other-long-password-123" } }));
});
test.after(async () => {
  nodemailer.createTransport = originalTransport;
  const { db } = await import("../../BE/sqlite"); db().close();
  await rm(dir, { recursive: true, force: true });
});


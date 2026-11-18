// Kiểm tra tài khoản đăng ký không bị yêu cầu xác minh email.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import { getMigrations } from "better-auth/db/migration";

const dir = await mkdtemp(path.join(tmpdir(), "dtu-otp-transition-"));
process.env.APP_DATA_DIR=dir;
process.env.BETTER_AUTH_SECRET="test-secret-please-use-32-bytes-minimum-123456789";
process.env.BETTER_AUTH_URL="http://localhost:3000";
process.env.EMAIL_OTP_ENABLED="true";
process.env.EMAIL_REQUIRE_VERIFICATION="false";
process.env.SMTP_HOST="smtp.example.test";
process.env.SMTP_USER="sender@example.test";
process.env.SMTP_PASSWORD="test-only";
let sent = "";
const original = nodemailer.createTransport;
nodemailer.createTransport = (() => ({sendMail:async (mail:{text:string}) => {sent=mail.text;},close(){}})) as unknown as typeof nodemailer.createTransport;
const {getAuth} = await import("../../BE/auth");
const auth = getAuth();
await (await getMigrations(auth.options)).runMigrations();
test("đăng ký không gửi mã xác minh", async () => {
  const email="student@example.test", password="long-test-password-123";
  await auth.api.signUpEmail({body:{email,password,name:"Student"}});
  assert.equal(sent, "");
  assert.ok((await auth.api.signInEmail({body:{email,password}})).user);
});
test.after(async () => {nodemailer.createTransport=original; (await import("../../BE/sqlite")).db().close(); await rm(dir,{recursive:true,force:true});});

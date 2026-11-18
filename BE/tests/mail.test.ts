// Kiểm thử cấu hình và nội dung email mà không gửi thư hoặc dùng mật khẩu thật.
import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { escapeMailHtml, mailConfig, otpMessage, passwordResetMessage, sendMail } from "../../BE/mail";
test("chỉ chấp nhận cấu hình SMTP đầy đủ và cổng hợp lệ", () => {
  assert.equal(mailConfig({ SMTP_HOST: "smtp.gmail.com" }), null);
  assert.equal(mailConfig({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "test@example.test", SMTP_PASSWORD: "placeholder", SMTP_PORT: "0" }), null);
  const config = mailConfig({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "test@example.test", SMTP_PASSWORD: "placeholder", SMTP_PORT: "465", SMTP_SECURE: "true" });
  assert.equal(config?.secure, true);
  assert.equal(config?.port, 465);
});
test("mẫu OTP có nội dung tiếng Việt và từ chối mã sai định dạng", () => {
  const message = otpMessage("test@example.test", "123456");
  assert.match(message.text, /5 phút/);
  assert.match(message.html, /123456/);
  assert.match(message.html, /cid:dtu-academic-logo/);
  assert.throws(() => otpMessage("test@example.test", "12<script>"));
  assert.equal(escapeMailHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});
test("khi thiếu cấu hình thì không thử kết nối SMTP", async () => {
  const previous = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try { await assert.rejects(sendMail({ to: "test@example.test", subject: "Test", text: "Test", html: "Test" }), /chưa được cấu hình/); }
  finally { if (previous !== undefined) process.env.SMTP_HOST = previous; }
});

// Kiểm tra link được giữ trong bản text và escape an toàn trong HTML.
test("mẫu đặt lại mật khẩu có nút và link dự phòng an toàn", () => {
  const url = "https://example.test/reset?token=sample&next=1";
  const message = passwordResetMessage("test@example.test", url);
  assert.ok(message.text.includes(url));
  assert.ok(message.html.includes("token=sample&amp;next=1"));
  assert.match(message.html, /Đặt lại mật khẩu/);
  assert.throws(() => passwordResetMessage("test@example.test", "javascript:alert(1)"));
});

test("thư OTP đính kèm logo nội tuyến", async () => {
  const keys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const;
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.SMTP_HOST="smtp.example.test"; process.env.SMTP_USER="test@example.test"; process.env.SMTP_PASSWORD="test-only";
  const original = nodemailer.createTransport;
  let sent: {attachments?: {cid:string}[]} | undefined;
  nodemailer.createTransport = (() => ({sendMail:async (mail:typeof sent) => {sent=mail;}, close(){}})) as unknown as typeof nodemailer.createTransport;
  try {
    await sendMail(otpMessage("recipient@example.test", "123456"));
    assert.equal(sent?.attachments?.[0]?.cid, "dtu-academic-logo");
  } finally {
    nodemailer.createTransport=original;
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key]=previous[key];
  }
});

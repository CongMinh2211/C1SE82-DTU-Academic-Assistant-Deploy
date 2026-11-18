// Gửi email từ máy chủ; không đưa SMTP hoặc mật khẩu ứng dụng tới trình duyệt.
import nodemailer from "nodemailer";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(254);
export type MailMessage = { to: string; subject: string; text: string; html: string };

// Thông báo rõ cấu hình thiếu mà không đưa giá trị bí mật vào lỗi hoặc log.
export function mailConfig(env: Record<string, string | undefined> = process.env) {
  const host = env.SMTP_HOST?.trim(), user = env.SMTP_USER?.trim(), password = env.SMTP_PASSWORD?.trim();
  const from = env.SMTP_FROM?.trim() || user;
  const port = Number(env.SMTP_PORT || 465);
  if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port, secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465, auth: { user, pass: password }, from };
}

// Các giá trị có thể do người dùng nhập phải được escape trước khi chèn vào HTML.
export function escapeMailHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Bố cục table và CSS nội tuyến giúp thư hiển thị ổn định trong Gmail và trên điện thoại.
function mailLayout(title: string, body: string, category = "BẢO MẬT TÀI KHOẢN", footer = "Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email và không chia sẻ thông tin xác thực với bất kỳ ai.") {
  return `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#f2f5fa;font-family:Arial,Helvetica,sans-serif;color:#173153"><div style="display:none;max-height:0;overflow:hidden">${escapeMailHtml(title)} - DTU Academic Assistant</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5fa"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e8f2;border-radius:16px"><tr><td style="padding:26px 28px;background:#173e70;border-radius:15px 15px 0 0"><img src="cid:dtu-academic-logo" alt="Đại học Duy Tân" width="150" style="display:block;max-width:150px;height:auto;padding:8px;background:#ffffff;border-radius:8px;margin-bottom:14px" /><p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold">DTU Academic Assistant</p><p style="margin:5px 0 0;color:#c8d9ee;font-size:12px;letter-spacing:1px">TRỢ LÝ HỌC VỤ</p></td></tr><tr><td style="padding:30px 28px"><p style="margin:0 0 10px;color:#b22832;font-size:11px;font-weight:bold;letter-spacing:1px">${escapeMailHtml(category)}</p><h1 style="margin:0 0 20px;color:#173153;font-size:23px;line-height:1.3">${escapeMailHtml(title)}</h1>${body}<p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e8edf4;color:#718198;font-size:13px;line-height:1.7">${escapeMailHtml(footer)}</p></td></tr></table><p style="max-width:540px;margin:20px 0 0;color:#8292a5;font-size:12px;line-height:1.6">DTU Academic Assistant · Thông báo tự động từ hệ thống</p></td></tr></table></body></html>`;
}

export function otpMessage(to: string, otp: string): MailMessage {
  if (!/^\d{6}$/.test(otp)) throw new Error("Mã xác minh không hợp lệ.");
  const action = "đặt lại mật khẩu";
  const title = "Mã đặt lại mật khẩu";
  const text = `DTU Academic Assistant\n\nMã ${action} của bạn: ${otp}\nMã có hiệu lực trong 5 phút và chỉ dùng một lần.\nNếu bạn không yêu cầu, hãy bỏ qua email này. Không chia sẻ mã với bất kỳ ai.`;
  const body = `<p style="margin:0;color:#4f6480;font-size:15px;line-height:1.7">Chào bạn,</p><p style="color:#4f6480;font-size:15px;line-height:1.7">Bạn vừa yêu cầu ${action}. Hãy nhập mã sau để tiếp tục:</p><div style="margin:24px 0;padding:18px 12px;border:1px solid #dbe7fa;border-radius:12px;background:#f2f7ff;text-align:center;color:#214bc0;font-size:30px;font-weight:bold;letter-spacing:8px">${escapeMailHtml(otp)}</div><p style="margin:0;color:#4f6480;font-size:14px;line-height:1.7">Mã có hiệu lực trong <strong>5 phút</strong> và chỉ được sử dụng một lần.</p>`;
  return { to, subject: `${title} - DTU Academic Assistant`, text, html: mailLayout(title, body) };
}

export function passwordResetMessage(to: string, url: string): MailMessage {
  // Chỉ đưa liên kết HTTP(S) hợp lệ vào nút, không cho dữ liệu phá vỡ thuộc tính HTML.
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Liên kết đặt lại mật khẩu không hợp lệ.");
  const safeUrl = escapeMailHtml(url);
  const text = `DTU Academic Assistant\n\nBạn vừa yêu cầu đặt lại mật khẩu. Mở liên kết sau (hết hạn sau 1 giờ):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;
  const body = `<p style="margin:0;color:#4f6480;font-size:15px;line-height:1.7">Chào bạn,</p><p style="color:#4f6480;font-size:15px;line-height:1.7">Bạn vừa yêu cầu đặt lại mật khẩu tài khoản. Nhấn nút bên dưới để tạo mật khẩu mới:</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 23px;border-radius:8px;background:#254dc8;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Đặt lại mật khẩu</a></p><p style="color:#4f6480;font-size:14px;line-height:1.7">Liên kết có hiệu lực trong <strong>1 giờ</strong>. Nếu nút không hoạt động, sao chép đường dẫn sau vào trình duyệt:</p><p style="overflow-wrap:anywhere;word-break:break-all;color:#3157b5;font-size:13px">${safeUrl}</p>`;
  return { to, subject: "Đặt lại mật khẩu - DTU Academic Assistant", text, html: mailLayout("Đặt lại mật khẩu", body) };
}

// Không đưa nội dung góp ý hoặc kết quả xử lý riêng tư vào email.
export function feedbackResolvedMessage(to: string, url: string): MailMessage {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Liên kết phản hồi không hợp lệ.");
  const title = "Góp ý của bạn đã được xử lý";
  const safeUrl = escapeMailHtml(url);
  const text = `DTU Academic Assistant\n\nGóp ý của bạn đã được quản trị viên xử lý. Đăng nhập ứng dụng để xem kết quả:\n${url}\n\nBạn nhận email này vì đã bật thông báo phản hồi. Có thể tắt trong Cài đặt → Thông báo.`;
  const body = `<p style="color:#4f6480;font-size:15px;line-height:1.7">Góp ý của bạn đã được quản trị viên xử lý. Đăng nhập ứng dụng để xem kết quả.</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 23px;border-radius:8px;background:#254dc8;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Xem kết quả phản hồi</a></p>`;
  return { to, subject: `${title} - DTU Academic Assistant`, text, html: mailLayout(title, body, "CẬP NHẬT PHẢN HỒI", "Bạn nhận email này vì đã bật thông báo phản hồi. Có thể tắt trong Cài đặt → Thông báo.") };
}

export async function sendMail(message: MailMessage) {
  const config = mailConfig();
  if (!config) throw new Error("Dịch vụ email chưa được cấu hình đầy đủ.");
  const to = emailSchema.parse(message.to);
  if (!message.subject.trim() || /[\r\n]/.test(message.subject)) throw new Error("Tiêu đề email không hợp lệ.");
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, requireTLS: !config.secure, auth: config.auth, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
  try {
    // Đính kèm logo nội tuyến để ứng dụng email không cần tải ảnh từ website bên ngoài.
    const logo = [path.resolve(process.cwd(), "FE/public/figma/dtu-logo.png"), path.resolve(process.cwd(), "public/figma/dtu-logo.png")].find(existsSync);
    const attachments = message.html.includes("cid:dtu-academic-logo") && logo ? [{ filename: "dtu-logo.png", path: logo, cid: "dtu-academic-logo", contentType: "image/png" }] : [];
    await transporter.sendMail({ from: config.from, to, subject: message.subject, text: message.text, html: message.html, attachments });
  } catch {
    // Tránh ghi lỗi gốc vì dịch vụ SMTP có thể trả lại dữ liệu nhạy cảm.
    throw new Error("Không thể gửi email. Vui lòng thử lại sau.");
  } finally {
    transporter.close();
  }
}


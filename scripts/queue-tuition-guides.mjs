import { readFile } from "node:fs/promises";
import path from "node:path";

// Chỉ nạp vào bản local ở trạng thái chờ duyệt; không công bố số tài khoản chưa xác minh.
const origin = "http://localhost:3000";
const account = JSON.parse(await readFile("config/accounts.json", "utf8"))
  .production.admin;
const login = await fetch(`${origin}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify(account),
});
if (!login.ok) throw new Error("Không thể đăng nhập quản trị local.");
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const headers = { Origin: origin, Cookie: cookie };
const response = await fetch(`${origin}/api/app/admin/documents`, { headers });
if (!response.ok) throw new Error("Không thể đọc danh sách nguồn local.");
const existing = await response.json();
const sources = [
  {
    title: "Hướng dẫn nộp học phí DTU - văn bản nhóm cung cấp",
    file: "knowledge/pending-review/tuition-payment/huong-dan-hoc-phi-trich-xuat.txt",
    scope:
      "Bản trích chữ từ DOCX nhóm cung cấp, chưa xác nhận ngày và hiệu lực. Hướng dẫn ATM mâu thuẫn thông báo HK2 2025-2026; phải đối chiếu với Ban Kế hoạch Tài chính trước khi duyệt.",
  },
  {
    title: "Hướng dẫn nộp học phí VietinBank - tài liệu 2022",
    file: "knowledge/pending-review/tuition-payment/huong-dan-vietinbank-goc.pdf",
    scope:
      "Tài liệu VietinBank nhóm cung cấp nêu thời điểm 16/02/2022; cần xác minh tính cập nhật của các bước trước khi công bố.",
  },
  {
    title: "Thông báo DTU nộp học phí HK2 2025-2026",
    url: "https://khoamtud.duytan.edu.vn/thong-bao-2b9/thong-bao-vv-nop-hoc-phi-hoc-ky-2-nam-hoc-2025-20263zrcw",
    scope:
      "Thông báo chính thức học kỳ 2 năm học 2025-2026, không tự áp dụng cho kỳ khác; ghi không nộp tại ATM. Cần kiểm tra thông báo mới nhất.",
  },
];
for (const source of sources) {
  if (existing.some((d) => d.title === source.title)) {
    console.log(`Đã có: ${source.title}`);
    continue;
  }
  let result;
  if (source.file) {
    const filename = path.basename(source.file),
      data = new FormData();
    data.set("title", source.title);
    data.set("scope", source.scope);
    data.set("topic", "Học phí");
    data.set(
      "file",
      new Blob([await readFile(source.file)], {
        type: filename.endsWith(".pdf") ? "application/pdf" : "text/plain",
      }),
      filename,
    );
    result = await fetch(`${origin}/api/app/admin/documents/upload`, {
      method: "POST",
      headers,
      body: data,
    });
  } else {
    result = await fetch(`${origin}/api/app/admin/documents/url`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: source.title,
        scope: source.scope,
        topic: "Học phí",
        url: source.url,
      }),
      signal: AbortSignal.timeout(30000),
    });
  }
  if (!result.ok) {
    console.log(`Chưa nhập được ${source.title}: HTTP ${result.status}.`);
    continue;
  }
  const item = await result.json();
  console.log(
    `Đã xếp hàng ${source.title} (${item.documentId}); chưa xuất bản.`,
  );
}

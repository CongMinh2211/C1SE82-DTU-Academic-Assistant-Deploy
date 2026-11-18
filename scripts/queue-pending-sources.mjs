import { readFile } from "node:fs/promises";
import path from "node:path";

// Chỉ đưa vào bản local và chờ Admin kiểm tra, không tự xuất bản.
const origin = "http://localhost:3000";
const accounts = JSON.parse(await readFile("config/accounts.json", "utf8"));
const login = await fetch(`${origin}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify(accounts.production.admin),
});
if (!login.ok) throw new Error("Không thể đăng nhập quản trị vào bản local.");
const cookie = login.headers
  .getSetCookie()
  .map((entry) => entry.split(";")[0])
  .join("; ");
const headers = { Origin: origin, Cookie: cookie };
const listResponse = await fetch(`${origin}/api/app/admin/documents`, {
  headers,
});
if (!listResponse.ok)
  throw new Error("Không thể kiểm tra danh sách tài liệu local.");
const documents = await listResponse.json();
const sources = [
  {
    title: "Danh bạ công khai Khoa Đào tạo Quốc tế - đối chiếu 25-10-2026",
    scope:
      "Danh bạ công khai Khoa Đào tạo Quốc tế, đối chiếu ngày 25/10/2026. Thông tin có thể thay đổi; xác nhận với Khoa trước khi sử dụng.",
    url: "https://is.duytan.edu.vn/international-school?page=1",
    file: "knowledge/pending-review/international-capstone/international-school-directory.txt",
  },
  {
    title: "Danh sách mentor Capstone 2026 - bản công khai trang 3",
    scope:
      "Danh sách mentor Capstone năm 2026 từ trang 3 của tài liệu được cung cấp. Không tự áp dụng cho kỳ hoặc phân công khác; xác nhận với Khoa.",
    url: "https://files01.duytan.edu.vn/svruploads/is-duytan/639054716897522780-dscap1-22026ver6.0student.pdf#page=3",
    file: "knowledge/pending-review/international-capstone/capstone-2026-mentors.txt",
  },
  {
    title: "Tài liệu Capstone 2026 - ba trang đầu",
    scope:
      "Ba trang đầu của tài liệu Capstone 2026, gồm kế hoạch, danh mục hồ sơ và danh sách mentor; các trang dữ liệu sinh viên đã loại bỏ.",
    url: "https://files01.duytan.edu.vn/svruploads/is-duytan/639054716897522780-dscap1-22026ver6.0student.pdf",
    file: "knowledge/pending-review/international-capstone/capstone-reference-pages-1-3.pdf",
  },
  {
    title: "Nội quy học đường DTU 2019 - chờ xác minh hiệu lực",
    scope:
      "Nội quy học đường năm 2019; cần xác minh văn bản thay thế và hiệu lực hiện nay. Không suy rộng thành nội quy phòng máy.",
    url: "https://files01.duytan.edu.vn/svruploads/banctsv-duytan/21ad14ea-e3f8-4be3-b045-e64ff44aef98_noiquyhocduong2019.pdf",
    file: "knowledge/pending-review/school-rules/DTU-noi-quy-hoc-duong-2019.pdf",
  },
  {
    title: "Nội quy học đường DTU 2019 - trang văn phòng trường",
    scope: "Quyết định 4457/QĐ-ĐHDT ngày 15/11/2019. Có nội dung về lớp học; cần xác minh còn hiệu lực và không suy rộng thành nội quy phòng máy.",
    url: "https://vanphong.duytan.edu.vn/quyet-dinh-cts/n244%3Bi-quy-hoc-%C4%91uong-cua-truong-%C4%91ai-hoc-duy-tan",
  },
];
for (const source of sources) {
  if (documents.some((document) => document.title === source.title)) {
    console.log(`Đã có, bỏ qua: ${source.title}`);
    continue;
  }
  if (!source.file) {
    const response = await fetch(`${origin}/api/app/admin/documents/url`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...source, topic: "Thủ tục" }),
      signal: AbortSignal.timeout(30000),
    }).catch(() => null);
    if (!response?.ok) {
      console.log(`Chưa lấy được trang nguồn ${source.title}: ${response ? `HTTP ${response.status}` : "hết thời gian hoặc lỗi kết nối"}.`);
      continue;
    }
    const result = await response.json();
    console.log(`Đã xếp hàng chờ lập chỉ mục: ${source.title} (${result.documentId}). Chưa xuất bản.`);
    continue;
  }
  const data = new FormData();
  for (const key of ["title", "scope", "url"]) data.set(key, source[key]);
  data.set("topic", "Thủ tục");
  const bytes = await readFile(source.file);
  const filename = path.basename(source.file);
  data.set(
    "file",
    new Blob([bytes], {
      type: filename.endsWith(".pdf") ? "application/pdf" : "text/plain",
    }),
    filename,
  );
  const response = await fetch(`${origin}/api/app/admin/documents/upload`, {
    method: "POST",
    headers,
    body: data,
  });
  if (!response.ok)
    throw new Error(
      `Không thể tạo nguồn ${source.title}: HTTP ${response.status}`,
    );
  const result = await response.json();
  console.log(
    `Đã xếp hàng chờ lập chỉ mục: ${source.title} (${result.documentId}). Chưa xuất bản.`,
  );
}

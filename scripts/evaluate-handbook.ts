// Kiểm tra có tìm thấy đúng nguồn/trang trong bộ sổ tay local, không gửi câu hỏi cá nhân hoặc gọi LLM.
import { retrieve } from "../BE/rag/retrieve";
import { db } from "../BE/db";

const cases = [
  { question: "học phần bắt buộc và học phần tự chọn là gì", pages: [8, 19] },
  { question: "cách đăng ký học phần và số chỗ còn lại", pages: [11, 20] },
  { question: "các thành phần đại cương và chuyên ngành trong chương trình đào tạo", pages: [16, 17] },
  { question: "thang điểm chữ và thang điểm 4", pages: [21] },
  { question: "công thức tính điểm trung bình chung học kỳ và tích lũy", pages: [22, 23] },
  { question: "cách đọc mã môn học MKT 251", pages: [33, 34] },
];
let passed = 0;
for (const item of cases) {
  const evidence = await retrieve(item.question);
  const found = evidence.filter((item) => item.title === "Sổ tay học phần");
  const hit = found.some((source) => item.pages.some((page) => page >= source.page && page <= source.pageEnd));
  if (hit) passed++;
  console.log(JSON.stringify({ question: item.question, expectedPages: item.pages, returnedPages: found.map((source) => source.page), passed: hit }));
}
console.log(JSON.stringify({ passed, total: cases.length, type: "retrieval-only" }));
await db().close();
if (passed !== cases.length) process.exitCode = 1;

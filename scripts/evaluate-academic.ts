import { answerQuestion } from "../BE/rag/answer";
import { normalize } from "../BE/rag/parser";
import { mkdir, writeFile } from "node:fs/promises";

const cases = [
  {
    id: "grade-d-f-with-scope",
    question:
      "Theo Điều 12 của Quy chế đào tạo trong tài liệu được cung cấp, điểm D và F nằm trong khoảng nào? Chỉ giải thích nội dung văn bản và nêu phạm vi áp dụng, không mặc định áp dụng cho mọi khóa DTU.",
    check: (text: string) =>
      /4(?:[,.]0{1,2})?\s*(?:đến|–|-)\s*5[,.]49/.test(text) &&
      /dưới\s*4/.test(text) &&
      /2026/.test(text),
    source: "TL01",
  },
  {
    id: "graduation-september-2026-complete-conditions",
    question:
      "Theo kế hoạch tốt nghiệp đợt tháng 9/2026, sinh viên cần đáp ứng đầy đủ những điều kiện nào để được xét công nhận tốt nghiệp? Hãy nêu cả lưu ý về học phí, lệ phí và hồ sơ liên quan.",
    check: (text: string) => {
      const t = normalize(text);
      return [
        /9\s*\/\s*2026|thang 9 nam 2026/,
        /truy cuu[\s\S]*hinh su/,
        /dinh chi hoc tap/,
        /hoan thanh[\s\S]*chuong trinh dao tao/,
        /hoi dong[\s\S]*5[,.]5/,
        /tttn|thuc tap tot nghiep/,
        /2[,.]0/,
        /quoc phong|gdqp/,
        /the chat|gdtc/,
        /tieng anh/,
        /tin hoc/,
        /ren luyen[\s\S]*trung binh/,
        /hoc phi[\s\S]*no|no[\s\S]*hoc phi/,
        /le phi[\s\S]*bao ve/,
        /ho so/,
      ].every((pattern) => pattern.test(t));
    },
    source: "TL02",
  },
  {
    id: "registration-improvement-procedure",
    question:
      "Theo thông báo đăng ký học phần HKI năm học 2026-2027, sinh viên có nhu cầu học cải thiện điểm phải liên hệ đâu và làm gì?",
    check: (text: string) => {
      const t = normalize(text);
      return (
        /khoa chu quan/.test(t) && /huong dan/.test(t) && /thu tuc/.test(t)
      );
    },
    source: "TL03",
  },
];
const results = [];
for (const item of cases) {
  const start = Date.now();
  const answer = await answerQuestion(item.question, [], false);
  const passed =
    answer.status === "answered" &&
    item.check(answer.content) &&
    answer.citations.some((c) => c.documentId === item.source);
  results.push({
    id: item.id,
    question: item.question,
    passed,
    latencyMs: Date.now() - start,
    answer,
  });
  console.log(
    JSON.stringify({
      id: item.id,
      passed,
      status: answer.status,
      reason: answer.reason,
      content: answer.content,
      sources: answer.citations.map((c) => `${c.documentId}:${c.page}`),
    }),
  );
}
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/academic-live-evaluation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      model: "gpt-5.4",
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      cases: results,
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;

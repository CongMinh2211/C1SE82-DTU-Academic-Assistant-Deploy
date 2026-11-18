import { answerQuestion } from "../BE/rag/answer";
import { mkdir, writeFile } from "node:fs/promises";
const cases = [
  { id: "hello", question: "xin chào", kind: "conversation" },
  {
    id: "capabilities",
    question: "Mình mới vào đây, bạn giúp mình được những gì vậy?",
    kind: "conversation",
  },
  {
    id: "english-greeting",
    question: "Hey there, how's it going?",
    kind: "conversation",
  },
  {
    id: "thanks-after-tuition",
    question: "Cảm ơn bạn nha!",
    kind: "conversation",
    history: [
      {
        role: "user" as const,
        content: "Học phí K31 mã 102 năm 2026-2027 bao nhiêu?",
      },
      { role: "assistant" as const, content: "18.160.000 đồng/học kỳ. [1]" },
    ],
  },
  {
    id: "greeting-plus-fact",
    question:
      "Chào bạn! Học phí K31 Công nghệ Phần mềm mã 102 năm 2026-2027 là bao nhiêu?",
    kind: "tuition",
  },
  {
    id: "web-default",
    question:
      "Theo website DTU, chương trình Sinh viên Ưu tú có chính sách học phí như thế nào? Nêu rõ nếu thông tin thuộc một giai đoạn trước đây.",
    kind: "web",
  },
  {
    id: "no-invented-fee",
    question:
      "Sinh viên K31 đóng học phí trễ 45 ngày bị phạt chính xác bao nhiêu tiền?",
    kind: "insufficient",
  },
];
const results = [];
for (const item of cases) {
  const start = Date.now();
  // Deliberately omit useWeb: its server-side default must be enabled.
  const answer = await answerQuestion(item.question, item.history || []);
  let passed = false;
  if (item.kind === "conversation")
    passed =
      answer.status === "conversation" &&
      answer.citations.length === 0 &&
      answer.webStatus === "not_needed" &&
      !/chưa.*(?:nguồn|căn cứ)|khóa nào|đợt tốt nghiệp/i.test(answer.content);
  if (item.kind === "tuition")
    passed =
      answer.status === "answered" &&
      answer.content.replace(/[.,\s]/g, "").includes("18160000") &&
      answer.citations.some((c) => c.documentId === "TL08");
  if (item.kind === "web")
    passed =
      answer.status === "answered" &&
      answer.webStatus === "fetched" &&
      answer.citations.some(
        (c) => c.documentId === "web" && c.url && c.retrievedAt,
      );
  if (item.kind === "insufficient")
    passed =
      ["insufficient", "clarification"].includes(answer.status) &&
      answer.citations.length === 0 &&
      !/\[[^\]]+\]/.test(answer.content);
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
      web: answer.webStatus,
      content: answer.content,
    }),
  );
}
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/support-live-evaluation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      cases: results,
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;

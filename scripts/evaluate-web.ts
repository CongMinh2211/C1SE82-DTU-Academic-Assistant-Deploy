import { answerQuestion } from "../BE/rag/answer";
import { writeFile, mkdir } from "node:fs/promises";
const question =
  "Theo website chính thức DTU, chương trình Sinh viên Ưu tú có chính sách học phí như thế nào? Nêu rõ nếu thông tin chỉ thuộc một giai đoạn trước đây.";
const answer = await answerQuestion(question, [], true);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/web-live-evaluation.json",
  JSON.stringify({ at: new Date().toISOString(), question, answer }, null, 2),
);
console.log(
  JSON.stringify({
    status: answer.status,
    webStatus: answer.webStatus,
    reason: answer.reason,
    webCitations: answer.citations
      .filter((c) => c.documentId === "web")
      .map((c) => ({ title: c.title, url: c.url, retrievedAt: c.retrievedAt })),
    content: answer.content,
  }),
);
if (answer.webStatus !== "fetched") process.exitCode = 1;

import { retrieve } from "../BE/rag/retrieve";
import { answerQuestion } from "../BE/rag/answer";
const question =
  process.argv.slice(2).join(" ") ||
  "Theo thông báo HKI năm học 2026-2027, sinh viên chương trình thường được đăng ký tối đa bao nhiêu tín chỉ?";
const evidence = await retrieve(question);
console.log(
  JSON.stringify(
    {
      event: "retrieval",
      sources: evidence.map((e) => ({
        id: e.id,
        title: e.title,
        page: e.page,
        text: e.text.slice(0, 800),
        score: e.score,
      })),
    },
    null,
    2,
  ),
);
if (process.env.PROBE_LIVE === "true") {
  const answer = await answerQuestion(question, [], false);
  console.log(JSON.stringify({ event: "answer", ...answer }, null, 2));
}

import { answerQuestion } from "../BE/rag/answer";
import { writeFile, mkdir } from "node:fs/promises";
const question =
  "Tự tìm trên web trang của Times Higher Education về Duy Tan University và cho mình biết trang đó giới thiệu trường như thế nào. Trích dẫn nguồn từ tổ chức này, không cần mình cung cấp link.";
const started = Date.now();
const answer = await answerQuestion(
  question,
  [],
  true,
  AbortSignal.timeout(120000),
);
const external = answer.citations.filter(
  (c) =>
    c.documentId === "web" &&
    c.discoveredBy === "web_search" &&
    c.url &&
    !/(^|\.)duytan\.edu\.vn$/.test(new URL(c.url).hostname),
);
const passed =
  answer.status === "answered" &&
  answer.webCoverage === "global" &&
  !/\[(?:S|W)\d+\]/.test(answer.content) &&
  external.length > 0 &&
  external.every(
    (c) =>
      c.quote.length > 120 &&
      c.retrievedAt &&
      c.assessment &&
      c.sourceTier !== "other",
  );
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/global-web-evaluation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      question,
      passed,
      latencyMs: Date.now() - started,
      answer,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed,
    status: answer.status,
    reason: answer.reason,
    coverage: answer.webCoverage,
    external: external.map((c) => ({ url: c.url, tier: c.sourceTier })),
    content: answer.content,
  }),
);
if (!passed) process.exitCode = 1;

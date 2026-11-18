import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { answerQuestion } from "../BE/rag/answer";
process.env.SAVEGATE_BASE_URL = "http://127.0.0.1:1/v1";
const results = [];
const quick = await answerQuestion("Bạn có thể làm được gì", [], false);
assert.equal(quick.reason, "capabilities");
assert.ok(quick.content.includes("học phí"));
results.push({ id: "features-available-without-model", passed: true });
const start = Date.now();
const table = await answerQuestion(
  "Học phí K31 mã 102 năm 2026-2027 bao nhiêu?",
  [],
  false,
);
assert.equal(table.status, "answered");
assert.equal(table.reason, "structured_tuition");
assert.ok(table.citations.length > 0);
results.push({ id: "tuition-table-available-without-model", passed: true });
const followUp = await answerQuestion(
  "Còn K27 thì sao? Giữ nguyên mã và năm học.",
  [
    { role: "user", content: "Học phí K31 mã 102 năm 2026-2027 bao nhiêu?" },
    { role: "assistant", content: table.content },
  ],
  false,
);
assert.equal(followUp.status, "answered");
assert.equal(followUp.reason, "structured_tuition");
assert.ok(followUp.content.replace(/[.,\s]/g, "").includes("11520000"));
results.push({ id: "tuition-follow-up-available-without-model", passed: true });
const error = await answerQuestion(
  "Theo Điều 12 của Quy chế đào tạo được cung cấp, điểm D và F nằm trong khoảng nào?",
  [],
  false,
  AbortSignal.timeout(30000),
);
assert.equal(error.status, "error");
assert.equal(error.citations.length, 0);
assert.match(error.content, /thử gửi lại/);
assert.ok(!error.content.includes("18.160.000"));
results.push({
  id: "provider-outage-no-fabrication-clear-retry",
  passed: true,
  latencyMs: Date.now() - start,
});
const cancellation = new AbortController();
cancellation.abort();
await assert.rejects(
  answerQuestion("Xin chào", [], true, cancellation.signal),
  { name: "AbortError" },
);
results.push({ id: "cancelled-request-stops-before-model", passed: true });
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/chat-failure-modes.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: results.length,
      total: results.length,
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: results.length, total: results.length }));
process.exit(0);

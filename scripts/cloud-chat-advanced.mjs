import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { origin, call } from "./cloud-http.mjs";
import { qualityCases } from "./chat-quality-cases.ts";
const creds = JSON.parse(await readFile("config/credentials/chat-qa.json", "utf8"));
const signed = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: creds.student,
});
assert.equal(signed.status, 200);
const cookie = signed.cookie;
const results = [];
let defaultMessage;
async function check(id, run) {
  const start = Date.now();
  try {
    const result = await run();
    results.push({
      id,
      passed: true,
      latencyMs: Date.now() - start,
      ...result,
    });
    console.log(JSON.stringify({ id, passed: true }));
  } catch (e) {
    results.push({
      id,
      passed: false,
      error: e.message,
      latencyMs: Date.now() - start,
    });
    console.log(JSON.stringify({ id, passed: false, error: e.message }));
  }
  await writeFile(
    "test-results/cloud-chat-advanced.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        origin,
        passed: results.every((r) => r.passed),
        total: results.length,
        results,
      },
      null,
      2,
    ),
  );
}
await check("complete-graduation-requirements-cloud", async () => {
  const item = qualityCases.find((c) => c.id === "graduation-full-conditions");
  const r = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: { question: item.question, requestId: randomUUID(), useWeb: false },
  });
  assert.equal(r.status, 200);
  const answer = r.payload.messages.at(-1);
  const criteria = item.check(answer);
  assert.ok(Object.values(criteria).every(Boolean), JSON.stringify(criteria));
  return { conversation: r.payload.id, answer, criteria };
});
await check("web-enabled-by-default-with-internal-grounding", async () => {
  const r = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: {
      question:
        "Trong thông báo đăng ký học phần HKI 2026-2027 của tài liệu đã cung cấp, sinh viên chương trình thường được đăng ký tối đa bao nhiêu tín chỉ, không tính Giáo dục thể chất?",
      requestId: randomUUID(),
    },
  });
  assert.equal(r.status, 200);
  defaultMessage = r.payload.messages.at(-1);
  assert.equal(defaultMessage.status, "answered");
  assert.match(defaultMessage.content, /19/);
  assert.ok(defaultMessage.citations.some((c) => c.documentId === "TL03"));
  const old = JSON.parse(await readFile("config/credentials/cloud-qa.json", "utf8"));
  const admin = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: old.admin,
  });
  assert.equal(admin.status, 200);
  const audit = await call("/api/app/admin/audit", { cookie: admin.cookie });
  const trace = audit.payload.traces.find(
    (t) => t.id === defaultMessage.trace_id,
  );
  assert.ok(trace);
  assert.ok(!/web:not_requested|web:not_needed/.test(trace.reason));
  return {
    conversation: r.payload.id,
    answer: defaultMessage,
    searchTrace: trace.reason,
  };
});
await check("english-tuition-and-original-private-pdf", async () => {
  const r = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: {
      question:
        "What is the tuition for cohort K31, programme code 102, academic year 2026-2027? Give both the semester and per-credit fees.",
      requestId: randomUUID(),
      useWeb: false,
    },
  });
  assert.equal(r.status, 200);
  const answer = r.payload.messages.at(-1);
  assert.equal(answer.status, "answered");
  assert.match(answer.content, /Per semester/);
  assert.match(answer.content, /Per credit/);
  assert.ok(answer.citations.some((c) => c.documentId === "TL08"));
  const file = await call(
    `/api/app/sources/${answer.id}/${answer.citations[0].id}/file`,
    { cookie },
  );
  assert.equal(file.status, 200);
  assert.match(file.response.headers.get("content-type"), /application\/pdf/);
  const bytes = Buffer.from(await file.response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  return { conversation: r.payload.id, answer, pdfBytes: bytes.length };
});
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    origin,
  }),
);
process.exit(results.every((r) => r.passed) ? 0 : 1);

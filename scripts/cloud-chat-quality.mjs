import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { origin, call } from "./cloud-http.mjs";
const results = [];
await mkdir("test-results", { recursive: true });
const student = {
  email: `chat-qc-${randomUUID().slice(0, 8)}@example.test`,
  password: randomUUID() + randomUUID(),
};
let cookie;
async function save() {
  await writeFile(
    "test-results/cloud-chat-quality.json",
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
async function check(id, run) {
  const start = Date.now();
  try {
    const detail = await run();
    results.push({
      id,
      passed: true,
      latencyMs: Date.now() - start,
      ...detail,
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
  await save();
}
async function ask(question, conversationId, useWeb = false) {
  const requestId = randomUUID();
  const r = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: { question, conversationId, requestId, useWeb },
  });
  assert.equal(r.status, 200);
  const answer = r.payload.messages.at(-1);
  assert.notEqual(answer.status, "error");
  assert.notEqual(answer.status, "processing");
  const refs = [...answer.content.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
  assert.ok(
    (answer.status !== "answered" && !answer.citations.length) ||
      refs.every((id) => answer.citations.some((c) => c.id === id)),
  );
  assert.ok(!/\[(?:S|W)\d+\]|sourceId|ALL_EVIDENCE/.test(answer.content));
  return { conversation: r.payload.id, requestId, answer };
}
let capabilityFlow, tuitionFlow, penaltyFlow, studyFlow, webFlow;
await check("student-login-real-cloud", async () => {
  const r = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { ...student, name: "Sinh viên QC hội thoại" },
  });
  assert.equal(r.status, 200);
  const login = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: student,
  });
  assert.equal(login.status, 200);
  assert.ok(login.cookie);
  cookie = login.cookie;
  await writeFile(
    "config/credentials/chat-qa.json",
    JSON.stringify(
      { origin: "https://dtu-academic-assistant.vercel.app", student },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return {};
});
if (!cookie) process.exit(1);
await check("capabilities-original-complaint", async () => {
  capabilityFlow = await ask("Bạn có thể làm được gì");
  const a = capabilityFlow.answer;
  assert.equal(a.status, "conversation");
  assert.equal(a.citations.length, 0);
  for (const s of ["học phí", "toàn web", "ôn thi", "myDTU"])
    assert.ok(a.content.includes(s));
  return capabilityFlow;
});
await check("capabilities-repair-real-history", async () => {
  const a = await ask(
    "Bạn có thể làm được gì, đang hỏi mà",
    capabilityFlow.conversation,
  );
  assert.equal(a.answer.status, "conversation");
  assert.match(a.answer.content, /Bạn nói đúng/);
  assert.match(a.answer.content, /Bạn có thể thử/);
  return a;
});
await check("study-plan-real-model", async () => {
  studyFlow = await ask(
    "Lập lịch ôn Cấu trúc dữ liệu 7 ngày, mỗi ngày 2 giờ. Em yếu cây và đồ thị. Cho bài tập thực hành cụ thể.",
  );
  const t = studyFlow.answer.content.toLowerCase();
  assert.equal(studyFlow.answer.status, "conversation");
  assert.match(t, /ngày 1/);
  assert.match(t, /ngày 7/);
  assert.match(t, /cây/);
  assert.match(t, /đồ thị/);
  return studyFlow;
});
await check("adapt-study-plan-follow-up", async () => {
  const a = await ask(
    "Rút lại chỉ còn 3 ngày, mỗi ngày 60 phút, vẫn ưu tiên hai phần em yếu. Cho lịch mới cụ thể.",
    studyFlow.conversation,
  );
  assert.equal(a.answer.status, "conversation");
  assert.match(a.answer.content, /ngày 3/i);
  assert.match(a.answer.content, /cây/i);
  assert.match(a.answer.content, /đồ thị/i);
  assert.ok(
    !/^\s*(?:Ngày|Day)\s+[4-7]\b/im.test(a.answer.content),
    "Three-day plan must not introduce a fourth or later day heading",
  );
  return a;
});
await check("tuition-k31-source-and-units", async () => {
  tuitionFlow = await ask(
    "Học phí K31 Công nghệ Phần mềm mã 102 năm học 2026-2027 là bao nhiêu? Nêu học kỳ và tín chỉ.",
  );
  const a = tuitionFlow.answer,
    n = a.content.replace(/[.,\s]/g, "");
  assert.equal(a.status, "answered");
  assert.ok(n.includes("18160000") && n.includes("1135000"));
  assert.ok(a.citations.some((c) => c.documentId === "TL08"));
  return tuitionFlow;
});
await check("cohort-switch-uses-new-table", async () => {
  const a = await ask(
    "Còn K27 thì sao? Giữ nguyên mã và năm học.",
    tuitionFlow.conversation,
  );
  const n = a.answer.content.replace(/[.,\s]/g, "");
  assert.equal(a.answer.status, "answered");
  assert.ok(
    n.includes("11520000") && n.includes("720000") && !n.includes("18160000"),
  );
  assert.ok(a.answer.citations.some((c) => c.documentId === "TL04"));
  return a;
});
await check("original-source-opens-and-is-owned", async () => {
  const a = tuitionFlow.answer;
  const r = await call(`/api/app/sources/${a.id}/${a.citations[0].id}`, {
    cookie,
  });
  assert.equal(r.status, 200);
  assert.ok(r.payload.pages.length);
  assert.equal(r.payload.citation.quote, a.citations[0].quote);
  const outside = await call(`/api/app/sources/${a.id}/${a.citations[0].id}`);
  assert.equal(outside.status, 401);
  return { message: a.id, citation: a.citations[0].id };
});
await check("retry-request-does-not-duplicate-messages", async () => {
  const before = await call(
    `/api/app/conversations/${tuitionFlow.conversation}`,
    { cookie },
  );
  const retry = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: {
      question:
        "Học phí K31 Công nghệ Phần mềm mã 102 năm học 2026-2027 là bao nhiêu? Nêu học kỳ và tín chỉ.",
      requestId: tuitionFlow.requestId,
      useWeb: false,
    },
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.payload.messages.length, before.payload.messages.length);
  return { conversation: tuitionFlow.conversation };
});
await check("unknown-penalty-has-specific-gap", async () => {
  penaltyFlow = await ask(
    "K31 mã 102, năm học 2026-2027, đóng học phí trễ 45 ngày bị phạt chính xác bao nhiêu tiền?",
  );
  const a = penaltyFlow.answer;
  assert.ok(["insufficient", "clarification"].includes(a.status));
  assert.equal(a.citations.length, 0);
  assert.match(a.content, /phạt|chậm|trễ|45/);
  assert.ok(!/khóa nào|năm học nào/.test(a.content));
  return penaltyFlow;
});
await check("useful-email-after-unconfirmed-policy", async () => {
  const a = await ask(
    "Soạn một email ngắn để hỏi rõ mức phạt và căn cứ áp dụng cho trường hợp vừa rồi. Để trống người nhận và thông tin chưa biết, không bịa địa chỉ email.",
    penaltyFlow.conversation,
  );
  assert.equal(a.answer.status, "conversation");
  assert.match(a.answer.content, /Kính gửi/);
  assert.match(a.answer.content, /K31/);
  assert.match(a.answer.content, /45/);
  assert.ok(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(a.answer.content));
  return a;
});
await check("whole-web-primary-source-without-user-url", async () => {
  webFlow = await ask(
    "Tự tìm trang Times Higher Education về Duy Tan University, cho biết năm thành lập trường theo trang đó và trích dẫn nguồn. Mình không có link.",
    undefined,
    true,
  );
  assert.equal(webFlow.answer.status, "answered");
  assert.match(webFlow.answer.content, /1994/);
  assert.ok(
    webFlow.answer.citations.some(
      (c) =>
        c.documentId === "web" &&
        c.url &&
        new URL(c.url).hostname.endsWith("timeshighereducation.com") &&
        c.retrievedAt &&
        c.quote.length > 120,
    ),
  );
  return webFlow;
});
await check("migrated-admin-data-and-web-trace", async () => {
  const old = JSON.parse(await readFile("config/credentials/cloud-qa.json", "utf8"));
  const login = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: old.admin,
  });
  assert.equal(login.status, 200);
  const stats = await call("/api/app/admin/stats", { cookie: login.cookie });
  assert.equal(stats.status, 200);
  assert.equal(stats.payload.published, 8);
  assert.equal(stats.payload.chunks, 1127);
  const audit = await call("/api/app/admin/audit", { cookie: login.cookie });
  assert.equal(audit.status, 200);
  const trace = audit.payload.traces.find(
    (t) => t.id === webFlow.answer.trace_id,
  );
  assert.ok(trace);
  assert.match(trace.reason, /web:fetched;coverage:global/);
  return { published: stats.payload.published, chunks: stats.payload.chunks };
});
await save();
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    origin,
  }),
);
process.exit(results.every((r) => r.passed) ? 0 : 1);

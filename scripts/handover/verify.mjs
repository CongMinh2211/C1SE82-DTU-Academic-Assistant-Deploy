import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  readJson,
  root,
  manifest,
  saveJson,
  sha,
  safePath,
  fail,
} from "./common.mjs";
import { httpClient } from "./http.mjs";
const origin = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push({ name, passed: true });
};
try {
  const call = httpClient(origin, {
    protectedDeployment: process.argv.includes("--protected"),
  });
  const a = await readJson(root + "/config/accounts.json");
  const m = await manifest();
  check("health", (await call("/api/health")).status === 200);
  check(
    "anonymous access blocked",
    (await call("/api/app/conversations")).status === 401,
  );
  const admin = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: a.production.admin,
  });
  check("admin credentials restored", admin.status === 200);
  const student = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: a.production.student,
  });
  check("student credentials restored", student.status === 200);
  check(
    "student cannot read admin data",
    (await call("/api/app/admin/stats", { cookie: student.cookie })).status ===
      403,
  );
  const stats = await call("/api/app/admin/stats", { cookie: admin.cookie });
  check(
    "published sources and chunks",
    stats.status === 200 &&
      stats.payload.published === m.counts.published &&
      stats.payload.chunks === m.counts.activeChunks,
  );
  const faqs = await call("/api/app/faqs", { cookie: student.cookie });
  check(
    "published FAQ dataset",
    faqs.status === 200 && faqs.payload.length === m.counts.publishedFaqs,
  );
  for (const faq of faqs.payload) {
    const source = await call("/api/app/faq-source/" + faq.id, {
      cookie: student.cookie,
    });
    check(
      "FAQ citation " + faq.id,
      source.status === 200 && !!source.payload.citation?.quote,
    );
  }
  const raw = await call(
    "/api/app/faq-source/" + faqs.payload[0].id + "/file",
    { cookie: student.cookie },
  );
  check(
    "original PDF readable",
    raw.status === 200 && raw.bytes.subarray(0, 4).toString() === "%PDF",
  );
  const history = await call("/api/app/conversations", {
    cookie: student.cookie,
  });
  check(
    "history restored",
    history.status === 200 && history.payload.length > 0,
  );
  const historic = await call(
    "/api/app/conversations/" + history.payload[0].id,
    { cookie: student.cookie },
  );
  check(
    "historical messages restored",
    historic.status === 200 && historic.payload.messages.length > 0,
  );
  const requestId = randomUUID();
  const greeting = await call("/api/app/chat", {
    cookie: student.cookie,
    method: "POST",
    body: { question: "Xin chào", requestId, useWeb: false },
  });
  check(
    "greeting response",
    greeting.status === 200 &&
      greeting.payload.messages.at(-1).status !== "insufficient",
  );
  const duplicate = await call("/api/app/chat", {
    cookie: student.cookie,
    method: "POST",
    body: { question: "Xin chào", requestId, useWeb: false },
  });
  check(
    "idempotent chat request",
    duplicate.status === 200 &&
      duplicate.payload.messages.length === greeting.payload.messages.length,
  );
  const answer = await call("/api/app/chat", {
    cookie: student.cookie,
    method: "POST",
    body: {
      question:
        "Học phí K29 mã 410(CMU) năm học 2026-2027 là bao nhiêu? Cho học kỳ và tín chỉ.",
      requestId: randomUUID(),
      useWeb: false,
    },
  });
  const message = answer.payload?.messages?.at(-1);
  check(
    "grounded tuition answer",
    answer.status === 200 &&
      message?.citations?.length > 0 &&
      /14[.,]900[.,]000/.test(message.content) &&
      /931[.,]250/.test(message.content),
  );
  const detail = await call(`/api/app/sources/${message.id}/1`, {
    cookie: student.cookie,
  });
  check(
    "exact cited passage",
    detail.status === 200 && /410\(CMU\)/.test(JSON.stringify(detail.payload)),
  );
  const pdf = await call(`/api/app/sources/${message.id}/1/file`, {
    cookie: student.cookie,
  });
  check(
    "citation PDF bytes",
    pdf.status === 200 && pdf.bytes.subarray(0, 4).toString() === "%PDF",
  );
  const revisions = await readJson(safePath(m.tables.revisions.file));
  const revision = revisions.find(
    (r) => r.id === message.citations[0].revisionId,
  );
  check(
    "citation file hash preserved",
    !!revision && sha(pdf.bytes) === m.files[revision.raw_path]?.sha256,
  );
  for (const route of [
    "/api/app/admin/analytics?days=7",
    "/api/app/admin/jobs-summary",
    "/api/app/admin/jobs",
    "/api/app/admin/audit?view=questions",
    "/api/app/admin/audit?view=events",
  ])
    check(route, (await call(route, { cookie: admin.cookie })).status === 200);
  const report = {
    at: new Date().toISOString(),
    origin,
    snapshot: m.at,
    passed: true,
    total: checks.length,
    checks,
    createdTestConversationIds: [greeting.payload.id, answer.payload.id],
  };
  await saveJson(root + "/test-results/handover-verification.json", report);
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  await saveJson(root + "/test-results/handover-verification.json", {
    at: new Date().toISOString(),
    origin,
    passed: false,
    checks,
    error: String(e.message).slice(0, 300),
  });
  fail(e);
}

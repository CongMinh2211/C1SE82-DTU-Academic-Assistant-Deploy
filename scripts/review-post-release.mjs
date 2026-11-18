import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { call, origin } from "./cloud-http.mjs";

const results = [];
const student = JSON.parse(
  await readFile("config/credentials/review-qa.json", "utf8"),
).student;
const admin = JSON.parse(
  await readFile("config/credentials/cloud-qa.json", "utf8"),
).admin;
async function check(id, run) {
  try {
    results.push({ id, passed: true, ...(await run()) });
  } catch (error) {
    results.push({ id, passed: false, error: error.message });
  }
  await writeFile(
    "test-results/review-post-release.json",
    JSON.stringify(
      {
        origin,
        at: new Date().toISOString(),
        passed: results.every((r) => r.passed),
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results.at(-1)));
}
let cookie;
await check("public-student-login-and-persisted-profile", async () => {
  const r = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: student,
  });
  assert.equal(r.status, 200);
  cookie = r.cookie;
  const me = await call("/api/app/me", { cookie });
  assert.equal(me.payload.user.cohort, "K29");
  assert.equal(me.payload.user.role, "user");
});
await check("whole-web-with-primary-source-without-user-url", async () => {
  assert.ok(cookie);
  const r = await call("/api/app/chat", {
    cookie,
    method: "POST",
    body: {
      question:
        "Tự tìm trang Times Higher Education về Duy Tan University, cho biết năm thành lập trường theo trang đó và trích dẫn nguồn. Mình không có link.",
      requestId: randomUUID(),
      useWeb: true,
    },
  });
  assert.equal(r.status, 200);
  const answer = r.payload.messages.at(-1);
  assert.equal(answer.status, "answered");
  assert.match(answer.content, /1994/);
  assert.ok(
    answer.citations.some(
      (c) =>
        c.documentId === "web" &&
        c.url &&
        new URL(c.url).hostname.endsWith("timeshighereducation.com") &&
        c.retrievedAt &&
        c.quote.length > 120,
    ),
  );
  return {
    answer: answer.content,
    sources: answer.citations.map((c) => ({
      url: c.url,
      retrievedAt: c.retrievedAt,
    })),
  };
});
await check("public-admin-data-and-production-api", async () => {
  const r = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: admin,
  });
  assert.equal(r.status, 200);
  const stats = await call("/api/app/admin/stats", { cookie: r.cookie });
  assert.equal(stats.payload.published, 8);
  assert.equal(stats.payload.chunks, 1127);
  for (const path of [
    "/api/app/admin/analytics?days=7",
    "/api/app/admin/jobs-summary",
    "/api/app/admin/audit?view=questions&page=2",
  ]) {
    assert.equal((await call(path, { cookie: r.cookie })).status, 200, path);
  }
  return { published: stats.payload.published, chunks: stats.payload.chunks };
});
if (results.some((r) => !r.passed)) process.exitCode = 1;

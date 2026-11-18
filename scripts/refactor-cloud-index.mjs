import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { put } from "@vercel/blob/client";
import { call, origin } from "./cloud-http.mjs";

const credentials = JSON.parse(
  await readFile("config/credentials/cloud-qa.json", "utf8"),
);
const login = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: credentials.admin,
});
assert.equal(login.status, 200);
const cookie = login.cookie;
let document;
const results = [];
async function check(id, fn) {
  const detail = await fn();
  results.push({ id, passed: true, ...detail });
  console.log(JSON.stringify({ id, passed: true }));
}
try {
  await check("private-direct-blob-upload-and-completion", async () => {
    const meta = {
      title: `QC refactor unpublished ${randomUUID()}`,
      topic: "general",
      scope: "Chỉ kiểm thử refactor; không xuất bản vào kho tri thức.",
      filename: "qc-refactor.pdf",
    };
    const grant = await call("/api/app/admin/uploads/start", {
      cookie,
      method: "POST",
      body: meta,
    });
    assert.equal(grant.status, 200);
    const token = await call("/api/uploads", {
      cookie,
      method: "POST",
      body: {
        type: "blob.generate-client-token",
        payload: {
          pathname: grant.payload.pathname,
          multipart: false,
          clientPayload: grant.payload.id,
        },
      },
    });
    assert.equal(token.status, 200);
    const bytes = await readFile(
      "knowledge/originals/dang-ky-hoc-phan-hk1-nh-2026-2027.pdf",
    );
    await put(
      grant.payload.pathname,
      new Blob([bytes], { type: "application/pdf" }),
      {
        access: "private",
        contentType: "application/pdf",
        token: token.payload.clientToken,
      },
    );
    const saved = await call("/api/app/admin/uploads/complete", {
      cookie,
      method: "POST",
      body: { id: grant.payload.id },
    });
    assert.equal(saved.status, 200);
    document = saved.payload;
    return { bytes: bytes.length };
  });
  await check("vercel-queue-native-pdf-and-lazy-parser", async () => {
    let revision;
    for (let i = 0; i < 50; i++) {
      const r = await call(`/api/app/admin/revision/${document.revisionId}`, {
        cookie,
      });
      assert.equal(r.status, 200);
      revision = r.payload;
      if (revision.status === "ready") break;
      assert.notEqual(revision.status, "failed", "Indexing failed");
      await setTimeout(3000);
    }
    assert.equal(revision.status, "ready");
    assert.ok(revision.pages.length > 0 && revision.chunks.length > 0);
    const docs = await call("/api/app/admin/documents", { cookie });
    assert.equal(
      docs.payload.find((d) => d.id === document.documentId).active_revision,
      null,
    );
    return {
      pages: revision.pages.length,
      chunks: revision.chunks.length,
      published: false,
    };
  });
} catch (e) {
  results.push({ id: "indexing-flow", passed: false, error: e.message });
  process.exitCode = 1;
} finally {
  if (document?.documentId) {
    const archived = await call(
      `/api/app/admin/documents/${document.documentId}`,
      { cookie, method: "DELETE" },
    );
    assert.equal(archived.status, 200);
    results.push({
      id: "qa-document-archived-without-publication",
      passed: true,
    });
  }
  const stats = await call("/api/app/admin/stats", { cookie });
  assert.equal(stats.payload.published, 8);
  assert.equal(stats.payload.chunks, 1127);
  await writeFile(
    "test-results/refactor-cloud-index.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        origin,
        passed: results.every((r) => r.passed),
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: results.every((r) => r.passed),
      checks: results.length,
    }),
  );
}

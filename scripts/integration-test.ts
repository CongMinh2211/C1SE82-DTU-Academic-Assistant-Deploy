import { mkdtemp, cp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import Database from "better-sqlite3";
import { usageWindow } from "../BE/usage";
import { routes } from "../FE/lib/routes";

const root = process.cwd(),
  testDir = await mkdtemp(path.join(tmpdir(), "dtu-integration-"));
const sourceDir = path.resolve(process.env.APP_DATA_DIR || "data");
await cp(sourceDir, testDir, {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith("academic.sqlite"),
});
const sourceDatabase = new Database(path.join(sourceDir, "academic.sqlite"));
await sourceDatabase.backup(path.join(testDir, "academic.sqlite"));
sourceDatabase.close();
const origin = "http://127.0.0.1:3100";
const env: NodeJS.ProcessEnv = {
  ...process.env,
  APP_DATA_DIR: testDir,
  BETTER_AUTH_URL: origin,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  API_PORT: "8101",
  BACKEND_INTERNAL_URL: "http://127.0.0.1:8101",
};
const results: { name: string; passed: boolean }[] = [];
let server: ChildProcess | undefined;
let backend: ChildProcess | undefined;
let serverOutput = "";
async function start() {
  backend = spawn(process.execPath, ["--import", "tsx", "BE/server.ts"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  backend.stdout?.on("data", b => { serverOutput += b; });
  backend.stderr?.on("data", b => { serverOutput += b; });
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "FE",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout?.on("data", (b) => {
    serverOutput += b;
  });
  server.stderr?.on("data", (b) => {
    serverOutput += b;
  });
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(origin + "/api/health");
      if (r.ok) return;
    } catch {}
    if (server.exitCode !== null) throw new Error("Test server did not start");
    await setTimeout(100);
  }
  throw new Error("Test server startup timeout");
}
async function stop() {
  backend?.kill("SIGTERM");
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise<void>((resolve) =>
    server!.once("exit", () => resolve()),
  );
  server.kill("SIGTERM");
  await stopped;
}
async function call(
  url: string,
  options: {
    cookie?: string;
    method?: string;
    body?: unknown;
    form?: FormData;
    omitOrigin?: boolean;
  } = {},
) {
  const response = await fetch(origin + url, {
    method: options.method || "GET",
    redirect: "manual",
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.omitOrigin ? {} : { Origin: origin }),
      ...(!options.form && options.body
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      options.form || (options.body ? JSON.stringify(options.body) : undefined),
  });
  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  const cookie = response.headers
    .getSetCookie()
    .filter((c) => !c.startsWith("__Secure-better-auth.session_data"))
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: response.status, payload, cookie, response };
}
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function indexOnce() {
  await new Promise<void>((resolve, reject) => {
    const worker = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/worker.ts", "--once"],
      { cwd: root, env, stdio: "ignore" },
    );
    worker.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Index worker failed")),
    );
  });
}
try {
  await start();
  await check("unauthenticated API is protected", async () => {
    assert.equal((await call("/api/app/conversations")).status, 401);
  });
  const suffix = randomUUID();
  const injected = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      email: `injected-${suffix}@example.test`,
      password: randomUUID() + "aA1!",
      name: "QA role injection",
      role: "admin",
    },
  });
  assert.ok(
    injected.status === 400 ||
      (injected.status === 200 && injected.payload.user.role === "user"),
  );
  const first = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      email: `qa-${suffix}@example.test`,
      password: randomUUID() + "aA1!",
      name: "QA student one",
    },
  });
  assert.equal(
    first.status,
    200,
    `Signup failed: ${first.payload?.code || "unknown"}`,
  );
  assert.equal(first.payload.user.role, "user");
  const student = first.cookie;
  const second = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      email: `qa2-${suffix}@example.test`,
      password: randomUUID() + "aA1!",
      name: "QA student two",
    },
  });
  assert.equal(second.status, 200);
  const other = second.cookie;
  const adminResult = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(adminResult.status, 200);
  const admin = adminResult.cookie;
  await check(
    "all 24 page URLs preserve authentication and role redirects",
    async () => {
      const publicPaths = [
        routes.login,
        routes.register,
        routes.resetPassword,
      ] as string[];
      for (const url of Object.values(routes)) {
        const anonymous = await call(url);
        if (publicPaths.includes(url)) {
          assert.equal(anonymous.status, 200, `Public page ${url}`);
        } else {
          assert.equal(anonymous.status, 307, `Anonymous redirect ${url}`);
          assert.equal(
            anonymous.response.headers.get("location"),
            routes.login,
          );
        }
        const isAdmin = url.startsWith("/quan-tri");
        const page = await call(url, { cookie: isAdmin ? admin : student });
        if (url === routes.login) {
          assert.equal(page.status, 307);
          assert.equal(page.response.headers.get("location"), routes.home);
        } else {
          assert.equal(page.status, 200, `Authenticated page ${url}`);
          assert.match(await page.response.text(), /<main/);
        }
        if (isAdmin) {
          const denied = await call(url, { cookie: student });
          assert.equal(denied.status, 307, `Role redirect ${url}`);
          assert.equal(denied.response.headers.get("location"), routes.home);
        }
      }
      const login = await call(routes.login, { cookie: admin });
      assert.equal(login.response.headers.get("location"), routes.dashboard);
      assert.equal(
        (await call("/unknown-refactor-page", { cookie: admin })).status,
        404,
      );
    },
  );
  await check(
    "signup cannot choose admin privileges; role checks protect administration",
    async () => {
      assert.equal(
        (await call("/api/app/admin/documents", { cookie: student })).status,
        403,
      );
      assert.equal(
        (await call("/api/app/admin/users", { cookie: student })).status,
        403,
      );
    },
  );
  await check("mutation requires same-origin protection", async () => {
    assert.equal(
      (
        await call("/api/app/feedback", {
          cookie: student,
          method: "POST",
          omitOrigin: true,
          body: { rating: 5, category: "QA", content: "Test feedback" },
        })
      ).status,
      403,
    );
  });
  await check(
    "student can update only their own four profile fields and keep them across sessions",
    async () => {
      const profile = {
        name: "QA hồ sơ đã cập nhật",
        studentCode: "2820123456",
        cohort: "29",
        major: "Hệ thống thông tin quản lý",
      };
      assert.equal(
        (
          await call("/api/app/me", {
            cookie: student,
            method: "POST",
            body: profile,
          })
        ).status,
        200,
      );
      const me = await call("/api/app/me", { cookie: student });
      assert.equal(me.payload.user.name, profile.name);
      assert.equal(me.payload.user.cohort, "K29");
      assert.equal(me.payload.user.studentCode, profile.studentCode);
      assert.equal(me.payload.user.major, profile.major);
      assert.equal(me.payload.user.email, first.payload.user.email);
      assert.equal(me.payload.user.role, "user");
      assert.equal(
        (await call("/api/app/me", { cookie: other })).payload.user.name,
        "QA student two",
      );
      for (const extra of [
        { role: "admin" },
        { email: "changed@example.test" },
        { id: second.payload.user.id },
      ])
        assert.equal(
          (
            await call("/api/app/me", {
              cookie: student,
              method: "POST",
              body: { ...profile, ...extra },
            })
          ).status,
          400,
        );
      assert.equal(
        (
          await call("/api/app/me", {
            cookie: student,
            method: "POST",
            body: { ...profile, cohort: "unlimited" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/api/app/me", {
            cookie: student,
            method: "POST",
            omitOrigin: true,
            body: profile,
          })
        ).status,
        403,
      );
      const settings = await call("/sinh-vien/cai-dat", { cookie: student });
      assert.equal(settings.status, 200);
      assert.match(await settings.response.text(), /Xác nhận mật khẩu mới/);
      const read = await call("/sinh-vien/tai-khoan", { cookie: student });
      assert.equal(read.status, 200);
      assert.doesNotMatch(await read.response.text(), /name="current"/);
    },
  );
  await check(
    "password settings require current password and revoke other sessions",
    async () => {
      const email = `password-qc-${suffix}@example.test`,
        oldPassword = randomUUID() + "aA1!",
        newPassword = randomUUID() + "bB2!";
      const created = await call("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password: oldPassword, name: "QA password settings" },
      });
      assert.equal(created.status, 200);
      const signed = await call("/api/auth/sign-in/email", {
        method: "POST",
        body: { email, password: oldPassword },
      });
      assert.equal(signed.status, 200);
      const bad = await call("/api/auth/change-password", {
        cookie: created.cookie,
        method: "POST",
        body: {
          currentPassword: "invalid-current-password",
          newPassword,
          revokeOtherSessions: true,
        },
      });
      assert.ok([400, 401].includes(bad.status));
      assert.equal(
        (await call("/api/app/me", { cookie: signed.cookie })).status,
        200,
      );
      assert.equal(
        (
          await call("/api/auth/change-password", {
            cookie: created.cookie,
            method: "POST",
            body: {
              currentPassword: oldPassword,
              newPassword,
              revokeOtherSessions: true,
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (await call("/api/app/me", { cookie: signed.cookie })).status,
        401,
      );
      assert.notEqual(
        (
          await call("/api/auth/sign-in/email", {
            method: "POST",
            body: { email, password: oldPassword },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call("/api/auth/sign-in/email", {
            method: "POST",
            body: { email, password: newPassword },
          })
        ).status,
        200,
      );
    },
  );
  const requestId = randomUUID();
  const conversation = await call("/api/app/chat", {
    cookie: student,
    method: "POST",
    body: {
      question:
        "Theo thông báo HKI năm học 2026-2027, chương trình thường được đăng ký tối đa bao nhiêu tín chỉ?",
      requestId,
      useWeb: false,
    },
  });
  assert.equal(conversation.status, 200);
  const conversationId = conversation.payload.id;
  const answer = conversation.payload.messages.at(-1);
  await check(
    "real Mastra + Savegate RAG answer has canonical PDF citation",
    async () => {
      assert.equal(answer.status, "answered");
      assert.match(answer.content, /19/);
      assert.match(answer.content, /01|1 tín chỉ/);
      assert.ok(answer.citations.length);
      for (const c of answer.citations) {
        assert.equal(c.documentId, "TL03");
        assert.equal(c.page, 2);
        assert.ok(c.quote.includes("19") || c.quote.includes("tối đa"));
      }
    },
  );
  await check(
    "idempotency prevents duplicate model requests and messages",
    async () => {
      const again = await call("/api/app/chat", {
        cookie: student,
        method: "POST",
        body: { question: "same request", requestId, useWeb: false },
      });
      assert.equal(again.payload.messages.length, 2);
      assert.equal(again.payload.id, conversationId);
    },
  );
  await check(
    "another student cannot read conversation or citation or submit feedback on it",
    async () => {
      assert.equal(
        (
          await call(`/api/app/conversations/${conversationId}`, {
            cookie: other,
          })
        ).status,
        404,
      );
      assert.equal(
        (await call(`/api/app/sources/${answer.id}/1`, { cookie: other }))
          .status,
        404,
      );
      assert.equal(
        (
          await call("/api/app/feedback", {
            cookie: other,
            method: "POST",
            body: {
              messageId: answer.id,
              rating: 1,
              category: "QA",
              content: "Unauthorized feedback",
            },
          })
        ).status,
        404,
      );
    },
  );
  await check(
    "source content and original PDF are accessible only to the owner",
    async () => {
      const source = await call(`/api/app/sources/${answer.id}/1`, {
        cookie: student,
      });
      assert.equal(source.status, 200);
      assert.ok(source.payload.pages[0].text.includes("19 tín chỉ"));
      const original = await fetch(
        origin + `/api/app/sources/${answer.id}/1/file`,
        { headers: { Cookie: student } },
      );
      assert.equal(original.status, 200);
      assert.equal((await original.text()).slice(0, 5), "%PDF-");
    },
  );
  await check(
    "history rename/search/trash/restore are persistent and owner-protected",
    async () => {
      const path = `/api/app/conversations/${conversationId}`;
      for (const body of [{ title: "Unauthorized" }, { restore: true }])
        assert.equal(
          (await call(path, { cookie: other, method: "PATCH", body })).status,
          404,
        );
      assert.equal(
        (await call(path, { cookie: other, method: "DELETE" })).status,
        404,
      );
      assert.equal(
        (
          await call(path, {
            cookie: student,
            method: "PATCH",
            body: { title: "Renamed QA history" },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call(path, {
            cookie: student,
            method: "PATCH",
            body: { title: " " },
          })
        ).status,
        400,
      );
      const searched = await call(
        "/api/app/conversations?view=history&q=Renamed",
        { cookie: student },
      );
      assert.equal(searched.payload.total, 1);
      assert.equal(
        (await call(path, { cookie: student, method: "DELETE" })).status,
        200,
      );
      assert.equal((await call(path, { cookie: student })).status, 404);
      assert.equal(
        (await call(`/api/app/sources/${answer.id}/1`, { cookie: student }))
          .status,
        404,
      );
      const trash = await call("/api/app/conversations?view=history&trash=1", {
        cookie: student,
      });
      assert.equal(trash.payload.items[0].id, conversationId);
      assert.equal(
        (
          await call(path, {
            cookie: student,
            method: "PATCH",
            body: { restore: true },
          })
        ).status,
        200,
      );
      const restored = await call(path, { cookie: student });
      assert.equal(restored.payload.title, "Renamed QA history");
      assert.deepEqual(
        restored.payload.messages.at(-1).citations,
        answer.citations,
      );
    },
  );
  const feedback = await call("/api/app/feedback", {
    cookie: student,
    method: "POST",
    body: {
      messageId: answer.id,
      rating: 5,
      category: "QA",
      content: "Kiểm thử góp ý có nguồn",
    },
  });
  assert.equal(feedback.status, 200);
  await check(
    "feedback resolution persists and is visible to the student",
    async () => {
      const resolved = await call(
        `/api/app/admin/feedback/${feedback.payload.id}`,
        {
          cookie: admin,
          method: "POST",
          body: { resolution: "Đã kiểm tra nguồn PDF trong kiểm thử." },
        },
      );
      assert.equal(resolved.status, 200);
      const list = await call("/api/app/feedback", { cookie: student });
      assert.equal(list.payload[0].status, "resolved");
    },
  );
  await stop();
  await start();
  await check(
    "session, conversation, answer and citations survive a server restart",
    async () => {
      const persisted = await call(`/api/app/conversations/${conversationId}`, {
        cookie: student,
      });
      assert.equal(persisted.status, 200);
      assert.deepEqual(
        persisted.payload.messages.at(-1).citations,
        answer.citations,
      );
    },
  );
  const content =
    "TÀI LIỆU KIỂM THỬ KHÔNG ÁP DỤNG THỰC TẾ\n\nQuy định QA: mã thử nghiệm là QA-ALPHA. Không áp dụng cho sinh viên.\n\nĐây là dữ liệu được tạo để kiểm tra vòng đời tài liệu và lập chỉ mục.";
  const form = new FormData();
  form.set("title", "QA Lifecycle Document");
  form.set("topic", "Thủ tục");
  form.set("scope", "Chỉ dùng trong kiểm thử, không phải quy định trường.");
  form.set(
    "file",
    new File([content], "qa-lifecycle.txt", { type: "text/plain" }),
  );
  const created = await call("/api/app/admin/documents/upload", {
    cookie: admin,
    method: "POST",
    form,
  });
  assert.equal(created.status, 200);
  const documentId = created.payload.documentId,
    revisionId = created.payload.revisionId;
  const database = new Database(path.join(testDir, "academic.sqlite"));
  await check(
    "unindexed and unpublished source cannot enter live RAG",
    async () => {
      assert.equal(
        (
          database
            .prepare("SELECT active_revision FROM documents WHERE id=?")
            .get(documentId) as { active_revision: null }
        ).active_revision,
        null,
      );
      const premature = await call(
        `/api/app/admin/documents/${documentId}/publish`,
        { cookie: admin, method: "POST", body: { revisionId } },
      );
      assert.equal(premature.status, 409);
    },
  );
  await indexOnce();
  await check(
    "durable worker indexes a new upload and requires publication",
    async () => {
      const revision = database
        .prepare("SELECT status,chunk_count FROM revisions WHERE id=?")
        .get(revisionId) as { status: string; chunk_count: number };
      assert.equal(revision.status, "ready");
      assert.ok(revision.chunk_count > 0);
      assert.equal(
        (
          await call(`/api/app/admin/documents/${documentId}/publish`, {
            cookie: admin,
            method: "POST",
            body: { revisionId },
          })
        ).status,
        200,
      );
    },
  );
  const bad = new FormData();
  bad.set("documentId", documentId);
  bad.set("title", "QA broken new revision");
  bad.set("topic", "Thủ tục");
  bad.set("scope", "Phiên bản lỗi dùng để kiểm thử tính nguyên tử.");
  bad.set(
    "file",
    new File(["%PDF-1.7\ninvalid truncated QA PDF"], "broken.pdf", {
      type: "application/pdf",
    }),
  );
  const updated = await call("/api/app/admin/documents/upload", {
    cookie: admin,
    method: "POST",
    form: bad,
  });
  assert.equal(updated.status, 200);
  await indexOnce();
  await check(
    "failed replacement preserves the published generation and its original metadata",
    async () => {
      assert.equal(
        (
          database
            .prepare("SELECT active_revision FROM documents WHERE id=?")
            .get(documentId) as { active_revision: string }
        ).active_revision,
        revisionId,
      );
      assert.equal(
        (
          database
            .prepare("SELECT status FROM revisions WHERE id=?")
            .get(updated.payload.revisionId) as { status: string }
        ).status,
        "failed",
      );
      assert.equal(
        (
          database
            .prepare("SELECT title_snapshot FROM revisions WHERE id=?")
            .get(revisionId) as { title_snapshot: string }
        ).title_snapshot,
        "QA Lifecycle Document",
      );
    },
  );
  const chunk = database
    .prepare("SELECT id,text FROM chunks WHERE revision_id=? LIMIT 1")
    .get(revisionId) as { id: string; text: string };
  await check(
    "FAQ publication requires an active source and students can verify it",
    async () => {
      const faq = await call("/api/app/admin/faqs", {
        cookie: admin,
        method: "POST",
        body: {
          question: "Câu hỏi QA không áp dụng thực tế?",
          answer: chunk.text,
          topic: "Thủ tục",
          sourceChunk: chunk.id,
          status: "published",
        },
      });
      assert.equal(faq.status, 200);
      const source = await call(`/api/app/faq-source/${faq.payload.id}`, {
        cookie: student,
      });
      assert.equal(source.status, 200);
      assert.equal(source.payload.citation.quote, chunk.text);
      assert.equal(
        (
          await call(`/api/app/faq-source/${faq.payload.id}/file`, {
            cookie: student,
          })
        ).status,
        200,
      );
    },
  );
  await check(
    "FAQ drafts can be saved without sources and publication/unpublication preserves content",
    async () => {
      const draft = {
        question: "FAQ draft without source QA?",
        answer: "Bản nháp phục vụ kiểm thử, không dùng cho sinh viên.",
        topic: "Thủ tục",
        status: "draft",
      };
      const created = await call("/api/app/admin/faqs", {
        cookie: admin,
        method: "POST",
        body: draft,
      });
      assert.equal(created.status, 200);
      const key = created.payload.id;
      assert.equal(
        (await call(`/api/app/faq-source/${key}`, { cookie: student })).status,
        404,
      );
      assert.equal(
        (
          await call("/api/app/admin/faqs", {
            cookie: admin,
            method: "POST",
            body: { ...draft, id: key, status: "published" },
          })
        ).status,
        400,
      );
      const sourced = {
        ...draft,
        id: key,
        sourceChunk: chunk.id,
        status: "published",
      };
      assert.equal(
        (
          await call("/api/app/admin/faqs", {
            cookie: admin,
            method: "POST",
            body: sourced,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call(`/api/app/admin/faqs/${key}/unpublish`, {
            cookie: admin,
            method: "POST",
            body: {},
          })
        ).status,
        200,
      );
      assert.equal(
        (await call(`/api/app/faq-source/${key}`, { cookie: student })).status,
        404,
      );
      const stored = (
        await call("/api/app/admin/faqs", { cookie: admin })
      ).payload.find((f: { id: string }) => f.id === key);
      assert.equal(stored.answer, draft.answer);
      assert.equal(stored.status, "draft");
    },
  );
  await check(
    "archiving removes a source and its FAQ from active knowledge immediately",
    async () => {
      assert.equal(
        (
          await call(`/api/app/admin/documents/${documentId}`, {
            cookie: admin,
            method: "DELETE",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          database
            .prepare("SELECT active_revision FROM documents WHERE id=?")
            .get(documentId) as { active_revision: null }
        ).active_revision,
        null,
      );
      assert.equal(
        (
          database
            .prepare(
              "SELECT count(*) n FROM faqs f JOIN chunks c ON c.id=f.source_chunk WHERE c.document_id=? AND f.status='published'",
            )
            .get(documentId) as { n: number }
        ).n,
        0,
      );
    },
  );
  await check("account suspension revokes existing sessions", async () => {
    assert.equal(
      (
        await call("/api/auth/admin/ban-user", {
          cookie: admin,
          method: "POST",
          body: {
            userId: second.payload.user.id,
            banReason: "QA isolation test",
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/app/conversations", { cookie: other })).status,
      401,
    );
  });
  await check("operational stats and audit reflect real actions", async () => {
    const stats = await call("/api/app/admin/stats", { cookie: admin });
    assert.equal(stats.status, 200);
    assert.ok(stats.payload.questions > 0);
    const logs = await call("/api/app/admin/audit", { cookie: admin });
    assert.ok(
      logs.payload.events.some(
        (a: { action: string }) => a.action === "document.published",
      ),
    );
  });
  await check(
    "usage analytics include all statuses and enforce admin access and valid filters",
    async () => {
      assert.equal(
        (await call("/api/app/admin/analytics?days=7", { cookie: student }))
          .status,
        403,
      );
      assert.equal(
        (await call("/api/app/admin/analytics?days=365", { cookie: admin }))
          .status,
        400,
      );
      assert.equal(
        (
          await call("/api/app/admin/analytics?days=7&topic=unknown", {
            cookie: admin,
          })
        ).status,
        400,
      );
      const report = await call("/api/app/admin/analytics?days=7", {
        cookie: admin,
      });
      assert.equal(report.status, 200);
      const window = usageWindow(7),
        total = (
          database
            .prepare(
              "SELECT count(*) n FROM traces WHERE created_at>=? AND created_at<?",
            )
            .get(window.start, window.end) as { n: number }
        ).n;
      assert.equal(report.payload.total, total);
      assert.equal(report.payload.daily.length, 7);
      assert.equal(
        report.payload.daily.reduce(
          (n: number, d: { count: number }) => n + d.count,
          0,
        ),
        total,
      );
      assert.equal(
        report.payload.topics.reduce(
          (n: number, d: { count: number }) => n + d.count,
          0,
        ),
        total,
      );
      const stats = await call("/api/app/admin/stats", { cookie: admin });
      assert.equal(
        stats.payload.insufficient,
        (
          database
            .prepare(
              "SELECT count(*) n FROM traces WHERE status='insufficient'",
            )
            .get() as { n: number }
        ).n,
      );
      const jobs = await call("/api/app/admin/jobs-summary", { cookie: admin });
      assert.equal(jobs.status, 200);
      assert.ok(Number.isInteger(jobs.payload.completedToday));
    },
  );
  await check(
    "admin audit has real pagination, global search and distinct status filters",
    async () => {
      const report = await call("/api/app/admin/audit?view=questions&page=1", {
        cookie: admin,
      });
      assert.equal(report.status, 200);
      assert.equal(
        report.payload.total,
        (
          database.prepare("SELECT count(*) n FROM traces t JOIN conversations c ON c.id=t.conversation_id WHERE c.deleted_at IS NULL").get() as {
            n: number;
          }
        ).n,
      );
      assert.ok(report.payload.traces.length <= 20);
      const trace = report.payload.traces[0];
      assert.ok(trace);
      const exact = await call(
        `/api/app/admin/audit?view=questions&q=${trace.id}`,
        { cookie: admin },
      );
      assert.equal(exact.payload.total, 1);
      assert.equal(exact.payload.traces[0].id, trace.id);
      const filter = await call(
        "/api/app/admin/audit?view=questions&status=answered",
        { cookie: admin },
      );
      assert.ok(
        filter.payload.traces.every(
          (t: { status: string }) => t.status === "answered",
        ),
      );
      const events = await call("/api/app/admin/audit?view=events", {
        cookie: admin,
      });
      assert.equal(events.status, 200);
      assert.ok(events.payload.events.length > 0);
      assert.equal(events.payload.traces.length, 0);
      assert.equal(
        (
          await call("/api/app/admin/audit?view=questions&page=-1", {
            cookie: admin,
          })
        ).status,
        400,
      );
      assert.equal(
        (await call("/api/app/admin/audit?view=questions", { cookie: student }))
          .status,
        403,
      );
    },
  );
  database.close();
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/integration.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: results.length,
        results,
        isolatedData: true,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: results.length, isolatedData: true }));
} finally {
  await stop();
  // Do not print raw SDK/server errors or HTTP headers: they can contain credentials.
  const key = process.env.SAVEGATE_API_KEY || "";
  if (key && serverOutput.includes(key))
    throw new Error("Secret appeared in server logs");
}

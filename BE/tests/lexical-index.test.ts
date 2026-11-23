import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = await mkdtemp(path.join(tmpdir(), "dtu-lexical-"));
process.env.APP_DATA_DIR = directory;
process.env.RAG_LEXICAL_ONLY = "true";
delete process.env.DATABASE_URL;
delete process.env.SOURCE_STORAGE;
const { db, row } = await import("../db");
const { saveRevision, runNextJob } = await import("../knowledge");

test("lập chỉ mục từ khóa vẫn giữ nội dung và trạng thái chờ duyệt", async () => {
  const source = await saveRevision({ title: "Thông báo tốt nghiệp thử nghiệm", topic: "Tốt nghiệp", scope: "Sinh viên thử nghiệm", kind: "upload", filename: "test.txt", mime: "text/plain", bytes: Buffer.from("Điều kiện tốt nghiệp yêu cầu sinh viên hoàn thành chương trình đào tạo.") }, "admin-test");
  assert.equal(await runNextJob(), true);
  const revision = await row<{status: string; chunk_count: number}>("SELECT status,chunk_count FROM revisions WHERE id=?", source.revisionId);
  assert.equal(revision?.status, "ready");
  assert.ok(Number(revision?.chunk_count) > 0);
});
test.after(async () => { await db().close(); await rm(directory, {recursive: true, force: true}); });

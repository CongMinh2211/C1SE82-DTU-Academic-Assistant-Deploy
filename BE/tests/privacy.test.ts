// Kiểm thử thao tác dữ liệu trên CSDL tạm, không động tới hội thoại thật.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = await mkdtemp(path.join(tmpdir(), "dtu-privacy-"));
process.env.APP_DATA_DIR = dir;
const { db, now, row } = await import("../../BE/db");
const { trashAllConversations, exportConversations } = await import("../../BE/privacy");
const connection = db();
for (const [id, owner] of [["mine", "owner"], ["other", "other"]]) {
  await connection.prepare("INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?)").run(id, owner, id, now(), now());
  await connection.prepare("INSERT INTO messages(id,conversation_id,role,content,status,citations_json,created_at) VALUES(?,?,?,?,?,?,?)").run(`m-${id}`, id, "user", "Nội dung", "saved", "[]", now());
}
await connection.prepare("INSERT INTO shared_conversations VALUES(?,?,?,?,?,?)").run("mine", "owner", "hash", "{}", now(), now());
test("chỉ xuất và chuyển hội thoại của chủ tài khoản, thu hồi chia sẻ", async () => {
  const data = await exportConversations("owner");
  assert.equal(data.conversations.length, 1); assert.equal(data.messages.length, 1);
  assert.equal((await trashAllConversations("owner")).count, 1);
  assert.ok((await row<{ deleted_at: string }>("SELECT deleted_at FROM conversations WHERE id=?", "mine"))?.deleted_at);
  assert.equal((await row<{ deleted_at: string | null }>("SELECT deleted_at FROM conversations WHERE id=?", "other"))?.deleted_at, null);
  assert.equal(await row("SELECT * FROM shared_conversations WHERE conversation_id=?", "mine"), undefined);
});
test("không xóa khi một hội thoại đang xử lý", async () => {
  await connection.prepare("UPDATE messages SET status='processing' WHERE id=?").run("m-other");
  await assert.rejects(trashAllConversations("other"), /chờ câu trả lời/);
  assert.equal((await row<{ deleted_at: string | null }>("SELECT deleted_at FROM conversations WHERE id=?", "other"))?.deleted_at, null);
});
test.after(async () => { const { db: localDb } = await import("../../BE/sqlite"); localDb().close(); await rm(dir, { recursive: true, force: true }); });

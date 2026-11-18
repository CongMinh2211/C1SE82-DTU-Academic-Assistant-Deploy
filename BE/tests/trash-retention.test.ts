import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// CSDL thử tách biệt hoàn toàn khỏi lịch sử thật của sinh viên.
const dir = await mkdtemp(path.join(tmpdir(), "dtu-trash-test-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
const { db, row } = await import("../../BE/db");
const {
  changeConversation,
  deleteTrashedConversation,
  purgeExpiredConversations,
} = await import("../../BE/conversations");
const database = db();
async function conversation(id: string, owner: string, deleted: string | null) {
  await database
    .prepare(
      "INSERT INTO conversations(id,user_id,title,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?)",
    )
    .run(id, owner, "Test", "2026-01-01", "2026-01-01", deleted);
}
test("chỉ chủ sở hữu được xóa hội thoại đã trong thùng rác", async () => {
  await conversation("own", "alice", "2026-10-20T00:00:00.000Z");
  await conversation("active", "alice", null);
  await assert.rejects(deleteTrashedConversation("bob", "own"));
  await assert.rejects(deleteTrashedConversation("alice", "active"));
  await deleteTrashedConversation("alice", "own");
  assert.equal(
    await row("SELECT id FROM conversations WHERE id=?", "own"),
    undefined,
  );
});
test("chỉ dọn hội thoại đủ 30 ngày, xóa tin nhắn và trace, giữ phản hồi", async () => {
  await conversation("old", "alice", "2026-09-29T00:00:00.000Z");
  await conversation("recent", "alice", "2026-10-01T00:00:00.000Z");
  await database
    .prepare(
      "INSERT INTO messages(id,conversation_id,role,content,status,created_at) VALUES (?,?,?,?,?,?)",
    )
    .run("m", "old", "assistant", "Dữ liệu riêng", "answered", "2026-01-01");
  await database.prepare("INSERT INTO shared_conversations(conversation_id,owner_id,token_hash,snapshot_json,expires_at,created_at) VALUES (?,?,?,?,?,?)").run("old", "alice", "hash", "{}", "2027-01-01", "2026-01-01");
  await database
    .prepare(
      "INSERT INTO traces(id,user_id,conversation_id,question,status,created_at) VALUES (?,?,?,?,?,?)",
    )
    .run("t", "alice", "old", "Câu hỏi riêng", "answered", "2026-01-01");
  await database
    .prepare(
      "INSERT INTO feedback(id,user_id,message_id,rating,category,content,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run("f", "alice", "m", 5, "test", "Nhận xét", "2026-01-01");
  assert.equal(
    await purgeExpiredConversations(new Date("2026-10-29T00:00:00.000Z")),
    1,
  );
  assert.equal(await row("SELECT id FROM messages WHERE id=?", "m"), undefined);
  assert.equal(await row("SELECT id FROM traces WHERE id=?", "t"), undefined);
  assert.equal(await row("SELECT conversation_id FROM shared_conversations WHERE conversation_id=?", "old"), undefined);
  assert.deepEqual(
    await row("SELECT message_id FROM feedback WHERE id=?", "f"),
    { message_id: null },
  );
  assert.ok(await row("SELECT id FROM conversations WHERE id=?", "recent"));
  assert.ok(await row("SELECT id FROM conversations WHERE id=?", "active"));
});
test("không cho khôi phục sau thời hạn nhưng vẫn khôi phục được trước hạn", async () => {
  const recent = new Date(Date.now() - 29 * 86400000).toISOString();
  const expired = new Date(Date.now() - 31 * 86400000).toISOString();
  await conversation("restore-recent", "alice", recent);
  await conversation("restore-expired", "alice", expired);
  await changeConversation("alice", "restore-recent", { restore: true });
  assert.equal(
    (
      await row<{ deleted_at: string | null }>(
        "SELECT deleted_at FROM conversations WHERE id=?",
        "restore-recent",
      )
    )?.deleted_at,
    null,
  );
  await assert.rejects(
    changeConversation("alice", "restore-expired", { restore: true }),
    /30 ngày/,
  );
});
test.after(async () => {
  await database.close();
  await rm(dir, { recursive: true, force: true });
});

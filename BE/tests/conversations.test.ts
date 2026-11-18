// Mục đích file: Kiểm thử: Quyền sở hữu, tìm kiếm, đổi tên, xóa mềm và khôi phục hội thoại.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = await mkdtemp(path.join(tmpdir(), "dtu-history-unit-"));
process.env.APP_DATA_DIR = directory;
const { db, now } = await import("../../BE/db");
const { changeConversation, historyPage } =
  await import("../../BE/conversations");
const connection = db();
await connection
  .prepare(
    "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
  )
  .run("own", "student", "Original title", now(), now());
await connection
  .prepare(
    "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
  )
  .run("other", "someone-else", "Private title", now(), now());
await connection
  .prepare(
    "INSERT INTO messages(id,conversation_id,role,content,status,citations_json,created_at) VALUES (?,?,?,?,?,?,?)",
  )
  .run(
    "answer",
    "own",
    "assistant",
    "Học phí có nguồn [1]",
    "answered",
    JSON.stringify([{ id: "1", quote: "Nguyên văn" }]),
    now(),
  );
// Kiểm tra tìm kiếm, đổi tên, thùng rác và khôi phục; người khác không được sửa hội thoại.
test("rename, trash, search and restore preserve messages and enforce ownership", async () => {
  await assert.rejects(
    async () =>
      await changeConversation("student", "other", { title: "Stolen" }),
    /Không tìm thấy/,
  );
  await assert.rejects(
    async () => await changeConversation("student", "other", { trash: true }),
    /Không tìm thấy/,
  );
  await assert.rejects(
    async () => await changeConversation("student", "other", { restore: true }),
    /Không tìm thấy/,
  );
  await changeConversation("student", "own", { title: "Tên mới" });
  assert.equal((await historyPage("student", false, "Tên mới", 1)).total, 1);
  assert.equal((await historyPage("student", false, "Học phí", 1)).total, 1);
  assert.equal((await historyPage("student", false, "HOC PHI", 1.2)).total, 1);
  assert.equal((await historyPage("student", false, "Private", 1)).total, 0);
  assert.equal((await historyPage("student", false, "%", 1)).total, 0);
  await changeConversation("student", "own", { trash: true });
  assert.equal((await historyPage("student", false, "", 1)).total, 0);
  assert.equal((await historyPage("student", true, "", 99)).page, 1);
  assert.equal((await historyPage("student", true, "", 1)).total, 1);
  await assert.rejects(
    async () =>
      await changeConversation("student", "own", { title: "Trash rename" }),
    /Không thể/,
  );
  await changeConversation("student", "own", { restore: true });
  assert.equal(
    (await historyPage("student", false, "", 1)).items[0].title,
    "Tên mới",
  );
  const message = (await connection
    .prepare("SELECT content,citations_json FROM messages WHERE id='answer'")
    .get()) as {
    content: string;
    citations_json: string;
  };
  assert.equal(message.content, "Học phí có nguồn [1]");
  assert.deepEqual(JSON.parse(message.citations_json), [
    { id: "1", quote: "Nguyên văn" },
  ]);
});
// Không chuyển hội thoại vào thùng rác khi câu trả lời còn đang xử lý.
test("pending conversations cannot be trashed during an answer", async () => {
  await connection
    .prepare(
      "INSERT INTO messages(id,conversation_id,role,status,created_at) VALUES ('pending','own','assistant','processing',?)",
    )
    .run(now());
  await assert.rejects(
    async () => await changeConversation("student", "own", { trash: true }),
    /Hãy chờ/,
  );
  assert.equal((await historyPage("student", false, "", 1)).total, 1);
});
test.after(async () => {
  await connection.close();
  await rm(directory, { recursive: true, force: true });
});

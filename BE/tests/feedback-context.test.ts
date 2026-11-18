// Mục đích file: Kiểm thử: Phản hồi gắn đúng câu hỏi, câu trả lời và quyền chủ sở hữu.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = await mkdtemp(path.join(tmpdir(), "dtu-feedback-test-"));
process.env.APP_DATA_DIR = directory;
delete process.env.DATABASE_URL;
const { db } = await import("../../BE/db");
const { feedbackContext } = await import("../../BE/feedback");
const connection = db();
await connection
  .prepare(
    "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
  )
  .run("own", "student-a", "Test", "2026-01-01", "2026-01-01");
for (const [id, role, content] of [
  ["q", "user", "Câu hỏi"],
  ["a", "assistant", "Câu trả lời"],
])
  await connection
    .prepare(
      "INSERT INTO messages(id,conversation_id,role,content,status,created_at) VALUES (?,?,?,?,?,?)",
    )
    .run(id, "own", role, content, "saved", "2026-01-01");

// Phản hồi phải lấy đúng câu hỏi và trả lời thuộc hội thoại của người gửi.
test("góp ý hiển thị đúng câu hỏi và câu trả lời của chủ hội thoại", async () => {
  assert.deepEqual(await feedbackContext("a", "student-a"), {
    question: "Câu hỏi",
    answer: "Câu trả lời",
  });
});
// Từ chối truy cập ngữ cảnh góp ý khi sai chủ, sai vai trò tin nhắn hoặc đã xóa.
test("người khác, tin nhắn người dùng và hội thoại đã xóa không được truy cập", async () => {
  await assert.rejects(feedbackContext("a", "student-b"), /Không tìm thấy/);
  await assert.rejects(feedbackContext("q", "student-a"), /Không tìm thấy/);
  await connection
    .prepare("UPDATE conversations SET deleted_at=? WHERE id=?")
    .run("2026-01-02", "own");
  await assert.rejects(feedbackContext("a", "student-a"), /Không tìm thấy/);
});
test.after(async () => {
  await connection.close();
  await rm(directory, { recursive: true, force: true });
});

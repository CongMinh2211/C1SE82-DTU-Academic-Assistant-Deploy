import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Dùng cơ sở dữ liệu tạm để không đọc hoặc sửa dữ liệu của người dùng thật.
const directory = await mkdtemp(path.join(tmpdir(), "dtu-admin-review-"));
process.env.APP_DATA_DIR = directory;
delete process.env.DATABASE_URL;
const { db, row } = await import("../../BE/db");
const { reviewAnswer, adminAuditPage } = await import("../../BE/admin-audit");
const connection = db();
await connection
  .prepare(
    "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
  )
  .run("conversation", "student", "Test", "2026-01-01", "2026-01-01");
await connection
  .prepare(
    "INSERT INTO traces(id,user_id,conversation_id,question,status,created_at) VALUES (?,?,?,?,?,?)",
  )
  .run(
    "trace",
    "student",
    "conversation",
    "Câu hỏi riêng",
    "answered",
    "2026-01-01",
  );
await connection
  .prepare(
    "INSERT INTO messages(id,conversation_id,role,content,status,trace_id,created_at,citations_json) VALUES (?,?,?,?,?,?,?,?)",
  )
  .run(
    "answer",
    "conversation",
    "assistant",
    "Câu trả lời riêng",
    "answered",
    "trace",
    "2026-01-01",
    JSON.stringify([
      { id: "1", title: "Quy định học vụ", quote: "Nội dung nguồn" },
    ]),
  );

test("xem câu trả lời ghi nhật ký mã lượt mà không sao chép nội dung", async () => {
  assert.equal(
    (await reviewAnswer("trace", "admin")).answer,
    "Câu trả lời riêng",
  );
  assert.equal(
    (await reviewAnswer("trace", "admin")).citations[0].title,
    "Quy định học vụ",
  );
  const event = await row<{
    action: string;
    entity_id: string;
    detail: string;
  }>(
    "SELECT action,entity_id,detail FROM audit WHERE actor_id=? LIMIT 1",
    "admin",
  );
  assert.deepEqual(event, {
    action: "question.answer_viewed",
    entity_id: "trace",
    detail: "{}",
  });
});
test("ẩn cả câu hỏi và câu trả lời khi hội thoại đã xóa", async () => {
  await connection
    .prepare("UPDATE conversations SET deleted_at=? WHERE id=?")
    .run("2026-01-02", "conversation");
  await assert.rejects(reviewAnswer("trace", "admin"), /Không tìm thấy/);
  assert.equal(
    (await adminAuditPage(new URLSearchParams("view=questions"))).total,
    0,
  );
});
test.after(async () => {
  await connection.close();
  await rm(directory, { recursive: true, force: true });
});

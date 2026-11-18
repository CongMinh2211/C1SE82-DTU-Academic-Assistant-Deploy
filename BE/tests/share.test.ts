// Mục đích file: Kiểm thử: Bản chụp hội thoại, quyền sở hữu, thời hạn, thay link và thu hồi.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
// Dùng CSDL tạm riêng để test không ghi vào lịch sử chat thật.
const directory = await mkdtemp(path.join(tmpdir(), "dtu-share-"));
// Đặt đường dẫn trước khi import vì cấu hình CSDL được đọc lúc khởi tạo.
process.env.APP_DATA_DIR = directory;
const { db, now } = await import("../../BE/db");
const {
  createConversationShare,
  readConversationShare,
  revokeConversationShare,
} = await import("../../BE/share");
// Tạo một hội thoại thuộc owner và một tin nhắn làm dữ liệu thử nghiệm.
const connection = db();
await connection
  .prepare(
    "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
  )
  .run("c1", "owner", "Hội thoại", now(), now());
await connection
  .prepare(
    "INSERT INTO messages(id,conversation_id,role,content,status,citations_json,created_at) VALUES (?,?,?,?,?,?,?)",
  )
  .run("m1", "c1", "user", "Câu hỏi", "saved", "[]", now());
test("chia sẻ bản chụp có thời hạn, quyền sở hữu và thu hồi", async () => {
  // Người khác không được tạo liên kết cho hội thoại của owner.
  await assert.rejects(createConversationShare("c1", "other"));
  // Tạo link đầu tiên và kiểm tra nội dung được chụp tại thời điểm tạo.
  const first = await createConversationShare("c1", "owner");
  assert.equal(
    (await readConversationShare(first.token))?.messages[0].content,
    "Câu hỏi",
  );
  // Thay nội dung gốc để chứng minh bản chụp không tự cập nhật.
  await connection
    .prepare("UPDATE messages SET content=? WHERE id=?")
    .run("Nội dung mới", "m1");
  assert.equal(
    (await readConversationShare(first.token))?.messages[0].content,
    "Câu hỏi",
  );
  // Tạo link mới vô hiệu link cũ và chụp nội dung mới nhất.
  const second = await createConversationShare("c1", "owner");
  assert.equal(await readConversationShare(first.token), null);
  assert.equal(
    (await readConversationShare(second.token))?.messages[0].content,
    "Nội dung mới",
  );
  // Chỉ chủ hội thoại được thu hồi; token sau thu hồi không còn đọc được.
  await assert.rejects(revokeConversationShare("c1", "other"));
  await revokeConversationShare("c1", "owner");
  assert.equal(await readConversationShare(second.token), null);
  assert.equal(await readConversationShare("invalid"), null);
  // Đặt thời điểm hết hạn trong quá khứ để kiểm tra link hết hiệu lực.
  const expired = await createConversationShare("c1", "owner");
  await connection.prepare("UPDATE shared_conversations SET expires_at=? WHERE conversation_id=?").run("2000-01-01T00:00:00.000Z", "c1");
  assert.equal(await readConversationShare(expired.token), null);
  // Đưa vào thùng rác rồi khôi phục không được mở lại link cũ.
  const deleted = await createConversationShare("c1", "owner");
  const { changeConversation } = await import("../../BE/conversations");
  await changeConversation("owner", "c1", {trash:true});
  await changeConversation("owner", "c1", {restore:true});
  assert.equal(await readConversationShare(deleted.token), null);
});
test.after(async () => {
  // Đóng kết nối và dọn thư mục dữ liệu thử nghiệm sau khi chạy xong.
  await connection.close();
  await rm(directory, { recursive: true, force: true });
});

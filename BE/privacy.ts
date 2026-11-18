// Các thao tác dữ liệu chỉ áp dụng cho chủ tài khoản hiện tại.
import { db, row, rows, now, audit } from "./db";
import { HttpError } from "./http";

export async function trashAllConversations(userId: string) {
  return db().transaction(async () => {
    // Không chuyển vào thùng rác khi câu trả lời đang xử lý để tránh ghi dở dang.
    const pending = await row("SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.user_id=? AND c.deleted_at IS NULL AND m.status='processing' LIMIT 1", userId);
    if (pending) throw new HttpError(409, "Hãy chờ câu trả lời hiện tại hoàn tất trước khi xóa lịch sử.");
    await db().prepare("DELETE FROM shared_conversations WHERE owner_id=? AND conversation_id IN (SELECT id FROM conversations WHERE user_id=? AND deleted_at IS NULL)").run(userId, userId);
    const result = await db().prepare("UPDATE conversations SET deleted_at=? WHERE user_id=? AND deleted_at IS NULL").run(now(), userId);
    await audit(userId, "conversations.trashed_all", userId);
    return { count: result.changes };
  })();
}

export async function exportConversations(userId: string) {
  // Chỉ xuất nội dung của chính chủ, gồm cả thùng rác và nguồn đã lưu cùng tin nhắn.
  const conversations = await rows("SELECT id,title,created_at,updated_at,deleted_at FROM conversations WHERE user_id=? ORDER BY created_at,id", userId);
  const messages = await rows("SELECT m.id,m.conversation_id,m.role,m.content,m.status,m.citations_json,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.user_id=? ORDER BY m.created_at,m.id", userId);
  return { exportedAt: now(), conversations, messages };
}

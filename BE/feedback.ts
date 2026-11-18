// Mục đích file: Tìm ngữ cảnh câu trả lời cho phản hồi của sinh viên và kiểm tra quyền truy cập.
import { row } from "./db";
import { HttpError } from "./http";

/** Chỉ chủ hội thoại còn hoạt động được xem nội dung gửi kèm góp ý. */
export async function feedbackContext(messageId: string, userId: string) {
  // Tìm tin nhắn trợ lý và câu hỏi người dùng gần nhất đứng trước trong cùng hội thoại.
  // Điều kiện chủ sở hữu và trạng thái xóa ngăn đọc phản hồi của người khác.
  const context = await row<{ question: string | null; answer: string }>(
    `SELECT m.content answer, (SELECT q.content FROM messages q
      WHERE q.conversation_id=m.conversation_id AND q.role='user'
      AND (q.created_at<m.created_at OR (q.created_at=m.created_at AND q.rowid<m.rowid))
      ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1) question
     FROM messages m JOIN conversations c ON c.id=m.conversation_id
     WHERE m.id=? AND m.role='assistant' AND c.user_id=? AND c.deleted_at IS NULL`,
    messageId,
    userId,
  );
  if (!context) throw new HttpError(404, "Không tìm thấy câu trả lời.");
  return context;
}

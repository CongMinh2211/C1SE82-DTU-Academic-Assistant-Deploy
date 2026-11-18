// Mục đích file: Tạo, đọc và thu hồi bản chụp hội thoại bằng liên kết có thời hạn; chỉ chủ hội thoại được quản lý.
import { createHash, randomBytes } from "node:crypto";
import { db, row, now } from "./db";
import { conversationDetail } from "./chat";
import { HttpError } from "./http";
import type { Citation } from "@/lib/contracts";

// Token chỉ xuất hiện trong liên kết; CSDL lưu hash và bản chụp, không tự cập nhật tin nhắn mới.
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createConversationShare(id: string, owner: string) {
  // Chỉ chủ hội thoại mới được tạo bản chia sẻ; không chụp khi câu trả lời còn đang xử lý.
  const conversation = await conversationDetail(id, owner);
  if (conversation.messages.some((m) => m.status === "processing"))
    throw new HttpError(409, "Hãy đợi câu trả lời hoàn tất trước khi chia sẻ.");
  const token = randomBytes(32).toString("base64url"),
    created = now();
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  // Bản chụp chỉ mang nội dung và thông tin nguồn cần xem, không gửi ID phiên hay thông tin đăng nhập.
  const snapshot = {
    title: conversation.title,
    messages: conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
      status: m.status,
      citations: m.citations.map((c: Citation) => ({
        id: c.id,
        title: c.title,
        page: c.page,
        url: c.url?.startsWith("https://") ? c.url : undefined,
      })),
    })),
  };
  // Mỗi hội thoại chỉ giữ một liên kết: tạo mới sẽ thay hash và vô hiệu liên kết cũ.
  await db()
    .prepare(
      `INSERT INTO shared_conversations(conversation_id,owner_id,token_hash,snapshot_json,expires_at,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET owner_id=excluded.owner_id,token_hash=excluded.token_hash,snapshot_json=excluded.snapshot_json,expires_at=excluded.expires_at,created_at=excluded.created_at`,
    )
    .run(
      id,
      owner,
      hashToken(token),
      JSON.stringify(snapshot),
      expires,
      created,
    );
  return { token, expires };
}
export async function revokeConversationShare(id: string, owner: string) {
  // Kiểm tra chủ sở hữu trước khi xóa bản chia sẻ khỏi cơ sở dữ liệu.
  await conversationDetail(id, owner);
  await db()
    .prepare(
      "DELETE FROM shared_conversations WHERE conversation_id=? AND owner_id=?",
    )
    .run(id, owner);
  return { ok: true };
}
export async function readConversationShare(token: string) {
  // Không cần đăng nhập để xem, nhưng token phải hợp lệ, chưa hết hạn và hội thoại chưa bị xóa.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const data = await row<{ snapshot_json: string }>(
    `SELECT s.snapshot_json FROM shared_conversations s JOIN conversations c ON c.id=s.conversation_id WHERE s.token_hash=? AND s.expires_at>? AND c.deleted_at IS NULL`,
    hashToken(token),
    now(),
  );
  return data
    ? (JSON.parse(data.snapshot_json) as {
        title: string;
        messages: {
          role: string;
          content: string;
          citations: {
            id: string;
            title: string;
            page: number;
            url?: string;
          }[];
        }[];
      })
    : null;
}

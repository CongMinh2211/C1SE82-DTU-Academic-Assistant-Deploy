// Mục đích file: Tìm, đổi tên, chuyển thùng rác và khôi phục hội thoại theo quyền của chủ sở hữu.
import { db, row, rows, now, audit } from "./db";
import { HttpError } from "./http";
import type { Conversation } from "@/lib/contracts";
const retentionMs = 30 * 24 * 60 * 60 * 1000;

// Xóa đồng thời hội thoại, tin nhắn, trace và liên kết chia sẻ; chỉ xử lý thùng rác.
async function removeTrash(
  key: string,
  userId: string | null,
  cutoff: string | null,
) {
  return db().transaction(async () => {
    const removed = await row<{ id: string; user_id: string }>(
      `DELETE FROM conversations WHERE id=? AND deleted_at IS NOT NULL${userId ? " AND user_id=?" : ""}${cutoff ? " AND deleted_at<=?" : ""} RETURNING id,user_id`,
      ...[key, ...(userId ? [userId] : []), ...(cutoff ? [cutoff] : [])],
    );
    if (!removed) return false;
    await db().prepare("DELETE FROM traces WHERE conversation_id=?").run(key);
    await audit(
      userId,
      cutoff ? "conversation.expired" : "conversation.permanently_deleted",
      key,
    );
    return true;
  })();
}
export async function deleteTrashedConversation(userId: string, key: string) {
  if (!(await removeTrash(key, userId, null)))
    throw new HttpError(404, "Không tìm thấy hội thoại trong thùng rác.");
  return { ok: true };
}
export async function purgeExpiredConversations(
  date = new Date(),
  limit = 100,
) {
  const cutoff = new Date(date.getTime() - retentionMs).toISOString();
  const expired = await rows<{ id: string }>(
    "SELECT id FROM conversations WHERE deleted_at IS NOT NULL AND deleted_at<=? ORDER BY deleted_at,id LIMIT ?",
    cutoff,
    limit,
  );
  let count = 0;
  for (const conversation of expired)
    if (await removeTrash(conversation.id, null, cutoff)) count++;
  return count;
}
export async function historyPage(
  userId: string,
  trash: boolean,
  query: string,
  requestedPage: number,
) {
  const term = `%${query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .slice(0, 200)
    .replace(/[\\%_]/g, "\\$&")}%`;
  const filter = `c.user_id=? AND c.deleted_at IS ${trash ? "NOT " : ""}NULL AND (search_fold(c.title) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND search_fold(m.content) LIKE ? ESCAPE '\\'))`;
  const total =
    (
      await row<{
        n: number;
      }>(
        `SELECT count(*) n FROM conversations c WHERE ${filter}`,
        userId,
        term,
        term,
      )
    )?.n || 0;
  const page = Math.min(
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
    Math.max(1, Math.ceil(total / 10)),
  );
  return {
    items: await rows<Conversation>(
      `SELECT c.* FROM conversations c WHERE ${filter} ORDER BY c.updated_at DESC,c.id LIMIT 10 OFFSET ?`,
      userId,
      term,
      term,
      (page - 1) * 10,
    ),
    total,
    page,
    size: 10,
  };
}
export async function changeConversation(
  userId: string,
  key: string,
  change: {
    title?: string;
    restore?: boolean;
    trash?: boolean;
  },
) {
  const conversation = await row<{
    deleted_at: string | null;
  }>(
    "SELECT deleted_at FROM conversations WHERE id=? AND user_id=?",
    key,
    userId,
  );
  if (!conversation) throw new HttpError(404, "Không tìm thấy hội thoại.");
  if (
    change.restore &&
    conversation.deleted_at &&
    Date.parse(conversation.deleted_at) <= Date.now() - retentionMs
  )
    throw new HttpError(410, "Hội thoại đã hết thời hạn khôi phục 30 ngày.");
  if (
    change.trash &&
    (await row(
      "SELECT id FROM messages WHERE conversation_id=? AND status='processing'",
      key,
    ))
  )
    throw new HttpError(
      409,
      "Hãy chờ câu trả lời hoàn tất trước khi chuyển hội thoại vào thùng rác.",
    );
  if (change.restore)
    await db()
      .prepare(
        "UPDATE conversations SET deleted_at=NULL WHERE id=? AND user_id=?",
      )
      .run(key, userId);
  else if (change.trash) {
    // Xóa liên kết trước khi chuyển vào thùng rác để khôi phục không tự mở lại chia sẻ cũ.
    await db()
      .prepare(
        "DELETE FROM shared_conversations WHERE conversation_id=? AND owner_id=?",
      )
      .run(key, userId);
    await db()
      .prepare("UPDATE conversations SET deleted_at=? WHERE id=? AND user_id=?")
      .run(now(), key, userId);
  } else if (change.title && !conversation.deleted_at)
    await db()
      .prepare("UPDATE conversations SET title=? WHERE id=? AND user_id=?")
      .run(change.title, key, userId);
  else throw new HttpError(400, "Không thể thực hiện thao tác này.");
  await audit(
    userId,
    change.restore
      ? "conversation.restored"
      : change.trash
        ? "conversation.trashed"
        : "conversation.renamed",
    key,
  );
  return { ok: true };
}

import { trashAllConversations } from "@/server/privacy";
// Mục đích file: Xử lý thu hồi liên kết hoặc xóa mềm tài nguyên theo quyền của tài khoản.
import { HttpError, session, sameOrigin } from "@/server/http";
import { db, now, audit } from "@/server/db";
import {
  changeConversation,
  deleteTrashedConversation,
} from "@/server/conversations";
import { revokeConversationShare } from "@/server/share";

function parts(request: Request) {
  return new URL(request.url).pathname.slice("/api/app/".length).split("/");
}

export const deleteResource = async (request: Request) => {
  // Kiểm tra origin và phiên trước khi thực hiện bất kỳ thao tác thay đổi dữ liệu nào.
  sameOrigin(request);
  const { user } = await session(request.headers);
  const path = parts(request);
  // Chỉ chuyển dữ liệu của người dùng hiện tại vào thùng rác sau khi người dùng xác nhận trên giao diện.
  if (path[0] === "conversations" && path[1] === "all" && !path[2])
    return trashAllConversations(user.id);
  // Thu hồi liên kết chia sẻ mà không xóa hội thoại gốc.
  if (path[0] === "conversations" && path[1] && path[2] === "share")
    return await revokeConversationShare(path[1], user.id);
  if (
    path[0] === "conversations" &&
    path[1] &&
    path[2] === "permanent" &&
    !path[3]
  )
    return deleteTrashedConversation(user.id, path[1]);
  if (path[0] === "conversations" && path[1]) {
    return await changeConversation(user.id, path[1], { trash: true });
  }
  // Các nhánh phía dưới chỉ dành cho quản trị viên.
  await session(request.headers, true);
  if (path[0] === "admin" && path[1] === "documents" && path[2]) {
    await db().transaction(async () => {
      // Gỡ phiên bản đang phục vụ và đưa các FAQ phụ thuộc vào tài liệu này về bản nháp.
      await db()
        .prepare(
          "UPDATE documents SET deleted_at=?,active_revision=NULL WHERE id=? AND deleted_at IS NULL",
        )
        .run(now(), path[2]);
      await db()
        .prepare(
          "UPDATE faqs SET status='draft',updated_at=? WHERE source_chunk IN (SELECT id FROM chunks WHERE document_id=?)",
        )
        .run(now(), path[2]);
      await audit(user.id, "document.archived", path[2]);
    })();
    return { ok: true };
  }
  if (path[0] === "admin" && path[1] === "faqs" && path[2]) {
    await db().prepare("DELETE FROM faqs WHERE id=?").run(path[2]);
    await audit(user.id, "faq.deleted", path[2]);
    return { ok: true };
  }
  throw new HttpError(404, "Không tìm thấy thao tác.");
};

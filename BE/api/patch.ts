import { saveNotificationPreferences } from "@/server/notifications";
// Mục đích file: Xử lý các yêu cầu cập nhật từng phần sau khi xác minh phiên và quyền của người dùng.
import { z } from "zod";
import { HttpError, session, sameOrigin, jsonBody } from "@/server/http";
import { changeConversation } from "@/server/conversations";
import { validateSourceValidity } from "@/server/rag/source-validity";
import { db, now, row, audit } from "@/server/db";

function parts(request: Request) {
  return new URL(request.url).pathname.slice("/api/app/".length).split("/");
}

export const patchResource = async (request: Request) => {
  // Yêu cầu sửa phải đến từ ứng dụng và có phiên đăng nhập hợp lệ.
  sameOrigin(request);
  const { user } = await session(request.headers);
  const path = parts(request);
  if (path[0] === "notification-preferences" && !path[1]) {
    const input = await jsonBody(request, z.object({ feedback_email: z.boolean() }).strict());
    return saveNotificationPreferences(user.id, input.feedback_email);
  }
  if (path[0] === "admin" && path[1] === "revisions" && path[2] && path[3] === "validity") {
    // Chỉ quản trị viên được thay đổi metadata; không sửa nội dung hay tự duyệt phiên bản.
    await session(request.headers, true);
    const input = await jsonBody(request, z.object({issuedOn:z.string().max(10), effectiveFrom:z.string().max(10), effectiveUntil:z.string().max(10), scopeKey:z.string().trim().max(120)}).strict());
    const problem = validateSourceValidity(input);
    if (problem) throw new HttpError(400, problem);
    const revision = await row<{document_id:string}>("SELECT r.document_id FROM revisions r JOIN documents d ON d.id=r.document_id WHERE r.id=? AND d.deleted_at IS NULL", path[2]);
    if (!revision) throw new HttpError(404, "Không tìm thấy phiên bản tài liệu.");
    await db().transaction(async () => {
      await db().prepare("UPDATE revisions SET issued_on=?,effective_from=?,effective_until=?,scope_key=? WHERE id=?").run(input.issuedOn || null,input.effectiveFrom || null,input.effectiveUntil || null,input.scopeKey || null,path[2]);
      await audit(user.id,"document.validity_updated",revision.document_id,{revisionId:path[2],...input});
    })();
    return {ok:true};
  }
  if (path[0] === "language-preferences" && !path[1]) {
    const input = await jsonBody(request, z.object({ui_language:z.enum(["vi","en","hi"]),answer_language:z.enum(["auto","vi","en","hi"])}).strict());
    await db().prepare("INSERT INTO user_language_preferences(user_id,ui_language,answer_language,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ui_language=excluded.ui_language,answer_language=excluded.answer_language,updated_at=excluded.updated_at").run(user.id,input.ui_language,input.answer_language,now());
    return input;
  }
  if (path[0] === "conversations" && path[1]) {
    // Chỉ chấp nhận một trong hai dạng: đổi tên hoặc khôi phục từ thùng rác.
    const change = await jsonBody(
      request,
      z.union([
        z.object({ title: z.string().trim().min(1).max(100) }).strict(),
        z.object({ restore: z.literal(true) }).strict(),
      ]),
    );
    return await changeConversation(user.id, path[1], change);
  }
  throw new HttpError(404, "Không tìm thấy thao tác.");
};

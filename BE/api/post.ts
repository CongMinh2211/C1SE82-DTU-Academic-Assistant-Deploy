import { resolveFeedback } from "@/server/notifications";
// Mục đích file: Tiếp nhận yêu cầu tạo hoặc thực hiện thao tác; xác thực, kiểm tra dữ liệu và gọi nghiệp vụ.
import { z } from "zod";
import { getAuth } from "@/server/auth";
import { profileSchema } from "@/lib/profile";
import { createUpload, completeUpload } from "@/server/cloud-uploads";
import {
  HttpError,
  session,
  sameOrigin,
  jsonBody,
  readLimited,
  rateLimit,
} from "@/server/http";
import { db, row, now, id, audit } from "@/server/db";
import {
  saveRevision,
  publishRevision,
  queueReindex,
} from "@/server/knowledge";
import { maxUploadBytes } from "@/server/config";
import { createConversationShare } from "@/server/share";
import { officialUrl, fetchOfficial } from "@/server/official-web";
import { uploadSourceUrl } from "@/server/source-metadata";
import { chat } from "@/server/chat";
import { uploadMime } from "@/server/document-format";
import { transcribeVoice } from "@/server/voice";
import { reviewAnswer } from "@/server/admin-audit";

function parts(request: Request) {
  return new URL(request.url).pathname.slice("/api/app/".length).split("/");
}

const documentSchema = z.object({
  documentId: z.string().min(1).max(100).optional(),
  title: z.string().trim().min(5).max(250),
  topic: z.string().min(1).max(80),
  scope: z.string().trim().min(10).max(1500),
  issuedOn: z.string().max(10).optional(),
  effectiveFrom: z.string().max(10).optional(),
  effectiveUntil: z.string().max(10).optional(),
  scopeKey: z.string().trim().max(120).optional(),
  url: z.string().url(),
});

const feedbackSchema = z.object({
  messageId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  category: z.string().min(1).max(100),
  content: z.string().trim().min(5).max(3000),
});

export const postResource = async (request: Request) => {
  const path = parts(request);
  if (path[0] === "chat") return chat(request);
  if (path[0] === "voice" && path[1] === "transcribe") return transcribeVoice(request);
  sameOrigin(request);
  const { user } = await session(request.headers);
  await rateLimit(`write:${user.id}`, 100, 60);
  // Tạo liên kết cho hội thoại thuộc về tài khoản đang đăng nhập.
  if (path[0] === "conversations" && path[1] && path[2] === "share")
    return await createConversationShare(path[1], user.id);
  if (path[0] === "me" && !path[1]) {
    const input = await jsonBody(request, profileSchema);
    await getAuth().api.updateUser({ headers: request.headers, body: input });
    await audit(user.id, "profile.updated", user.id);
    return { ok: true };
  }
  if (path[0] === "feedback") {
    const input = await jsonBody(request, feedbackSchema);
    if (
      input.messageId &&
      !(await row(
        "SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND m.role='assistant' AND c.user_id=? AND c.deleted_at IS NULL",
        input.messageId,
        user.id,
      ))
    )
      throw new HttpError(404, "Không tìm thấy câu trả lời.");
    const key = id();
    await db()
      .prepare(
        "INSERT INTO feedback(id,user_id,message_id,rating,category,content,created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        key,
        user.id,
        input.messageId || null,
        input.rating,
        input.category,
        input.content,
        now(),
      );
    return { id: key };
  }
  await session(request.headers, true);
  if (path[0] === "admin" && path[1] === "crawl-schedules") {
    if (path[2] && path[3] === "run-now") {
      const changed = await db().prepare("UPDATE crawl_schedules SET next_run=? WHERE id=? AND enabled=1").run(Date.now(),path[2]);
      if (!changed.changes) throw new HttpError(404,"Không tìm thấy lịch đang hoạt động.");
      await audit(user.id,"crawl.requested",path[2]);
      return {ok:true};
    }
    if (path[2] && path[3] === "disable") {
      await db().prepare("UPDATE crawl_schedules SET enabled=0 WHERE id=?").run(path[2]);
      await audit(user.id,"crawl.disabled",path[2]);
      return {ok:true};
    }
    const input = await jsonBody(request, z.object({url:z.string().url().max(2048),topic:z.string().min(1).max(80),scope:z.string().trim().min(10).max(1500),intervalHours:z.number().int().min(6).max(168),maxPages:z.number().int().min(1).max(10)}).strict());
    const url = officialUrl(input.url).href, key = id();
    await db().prepare("INSERT INTO crawl_schedules(id,start_url,topic,scope,interval_hours,max_pages,created_by,next_run,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(key,url,input.topic,input.scope,input.intervalHours,input.maxPages,user.id,Date.now(),now());
    await audit(user.id,"crawl.created",key,{url,intervalHours:input.intervalHours,maxPages:input.maxPages});
    return {id:key};
  }
  if (
    path[0] === "admin" &&
    path[1] === "users" &&
    path[2] &&
    path[3] === "delete"
  ) {
    const target = await row<{ id: string; role: string; banned: boolean }>(
      "SELECT id,role,banned FROM user WHERE id=?",
      path[2],
    );
    if (!target) throw new HttpError(404, "Không tìm thấy tài khoản.");
    if (target.id === user.id || target.role === "admin")
      throw new HttpError(403, "Không thể xóa tài khoản quản trị tại đây.");
    if (!target.banned)
      throw new HttpError(409, "Hãy tạm khóa tài khoản trước khi xóa.");
    // Không xóa âm thầm các dữ liệu học vụ hoặc nhật ký có liên quan đến người dùng.
    const activity = await row<{ n: number }>(
      "SELECT (SELECT count(*) FROM conversations WHERE user_id=?) + (SELECT count(*) FROM feedback WHERE user_id=? OR resolved_by=?) + (SELECT count(*) FROM traces WHERE user_id=?) + (SELECT count(*) FROM audit WHERE actor_id=?) + (SELECT count(*) FROM faqs WHERE updated_by=?) AS n",
      target.id,
      target.id,
      target.id,
      target.id,
      target.id,
      target.id,
    );
    if (Number(activity?.n || 0) > 0)
      throw new HttpError(
        409,
        "Tài khoản đã có dữ liệu hoặc nhật ký. Hãy tạm khóa thay vì xóa.",
      );
    await getAuth().api.removeUser({
      headers: request.headers,
      body: { userId: target.id },
    });
    await audit(user.id, "user.deleted", target.id);
    return { ok: true };
  }
  if (
    path[0] === "admin" &&
    path[1] === "users" &&
    path[2] &&
    path[3] === "update"
  ) {
    const input = await jsonBody(
      request,
      z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        role: z.enum(["user", "admin"]),
      }),
    );
    const target = await row<{
      id: string;
      email: string;
      role: string;
      google_linked: number;
    }>(
      "SELECT u.id,u.email,u.role,CASE WHEN EXISTS (SELECT 1 FROM account a WHERE a.userId=u.id AND a.providerId='google') THEN 1 ELSE 0 END google_linked FROM user u WHERE u.id=?",
      path[2],
    );
    if (!target) throw new HttpError(404, "Không tìm thấy tài khoản.");
    if (target.id === user.id || target.role === "admin")
      throw new HttpError(403, "Không thể chỉnh tài khoản quản trị tại đây.");
    const emailChanged =
      target.email.toLowerCase() !== input.email.toLowerCase();
    // Không thay email định danh Google qua biểu mẫu quản trị để tránh gắn sai danh tính.
    if (emailChanged && target.google_linked)
      throw new HttpError(
        400,
        "Không thể đổi email của tài khoản đã liên kết Google.",
      );
    await getAuth().api.adminUpdateUser({
      headers: request.headers,
      body: {
        userId: target.id,
        data: { ...input, ...(emailChanged ? { emailVerified: false } : {}) },
      },
    });
    // Thay quyền hoặc email phải kết thúc phiên cũ để áp dụng cấu hình mới.
    if (emailChanged || target.role !== input.role)
      await getAuth().api.revokeUserSessions({
        headers: request.headers,
        body: { userId: target.id },
      });
    await audit(user.id, "user.updated", target.id, {
      emailChanged,
      roleChanged: target.role !== input.role,
    });
    return { ok: true };
  }
  if (
    path[0] === "admin" &&
    path[1] === "audit" &&
    path[2] &&
    path[3] === "answer"
  ) {
    return reviewAnswer(path[2], user.id);
  }
  if (path[0] === "admin" && path[1] === "uploads") {
    if (path[2] === "start") return createUpload(request);
    if (path[2] === "complete") return completeUpload(request);
  }
  if (path[0] === "admin" && path[1] === "documents") {
    if (path[2] === "upload") {
      const bytes = await readLimited(request, maxUploadBytes + 128 * 1024);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": request.headers.get("content-type") || "" },
        body: bytes,
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new HttpError(400, "Chưa chọn tài liệu.");
      const meta = z
        .object({
          title: z.string().trim().min(5).max(250),
          topic: z.string().min(1).max(80),
          scope: z.string().trim().min(10).max(1500),
          issuedOn: z.string().max(10).optional(),
          effectiveFrom: z.string().max(10).optional(),
          effectiveUntil: z.string().max(10).optional(),
          scopeKey: z.string().trim().max(120).optional(),
          url: z.union([z.string().url().max(2048), z.literal("")]).optional(),
          documentId: z.string().max(100).optional(),
        })
        .safeParse(Object.fromEntries([...form].filter(([k]) => k !== "file")));
      if (!meta.success)
        throw new HttpError(400, "Cần tiêu đề, chủ đề và phạm vi áp dụng.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = uploadMime(file.name, buffer);
      return saveRevision(
        {
          ...meta.data,
          url: uploadSourceUrl(meta.data.url),
          kind: "upload",
          filename: file.name,
          mime,
          bytes: buffer,
        },
        user.id,
      );
    }
    if (path[2] === "url") {
      const input = await jsonBody(request, documentSchema);
      const fetched = await fetchOfficial(input.url, {
        maxBytes: maxUploadBytes,
      });
      if (!/text\/html|application\/pdf|text\/plain/.test(fetched.mime))
        throw new HttpError(415, "Nguồn không phải HTML, PDF hoặc TXT.");
      const mime = fetched.mime.includes("application/pdf")
        ? "application/pdf"
        : fetched.mime.includes("text/html")
          ? "text/html"
          : "text/plain";
      return saveRevision(
        {
          ...input,
          kind: "url",
          url: fetched.url,
          filename:
            new URL(fetched.url).pathname.split("/").pop() || "web-source",
          mime,
          bytes: fetched.bytes,
        },
        user.id,
      );
    }
    if (path[2] && path[3] === "publish") {
      const body = await jsonBody(
        request,
        z.object({ revisionId: z.string().uuid() }),
      );
      const r = await row<{
        document_id: string;
      }>("SELECT document_id FROM revisions WHERE id=?", body.revisionId);
      if (r?.document_id !== path[2])
        throw new HttpError(404, "Phiên bản không thuộc tài liệu.");
      await publishRevision(body.revisionId, user.id);
      return { ok: true };
    }
    if (path[2] && path[3] === "reindex") {
      const body = await jsonBody(
        request,
        z.object({ revisionId: z.string().uuid() }),
      );
      const r = await row<{
        document_id: string;
      }>("SELECT document_id FROM revisions WHERE id=?", body.revisionId);
      if (r?.document_id !== path[2])
        throw new HttpError(404, "Phiên bản không thuộc tài liệu.");
      await queueReindex(body.revisionId, user.id);
      return { ok: true };
    }
  }
  if (path[0] === "admin" && path[1] === "feedback" && path[2]) {
    const input = await jsonBody(
      request,
      z.object({ resolution: z.string().trim().min(5).max(2000) }),
    );
    return resolveFeedback(path[2], user.id, input.resolution);
  }
  if (
    path[0] === "admin" &&
    path[1] === "faqs" &&
    path[2] &&
    path[3] === "unpublish"
  ) {
    const changed = await db()
      .prepare(
        "UPDATE faqs SET status='draft',updated_by=?,updated_at=? WHERE id=? AND status='published'",
      )
      .run(user.id, now(), path[2]);
    if (!changed.changes)
      throw new HttpError(409, "FAQ không còn được xuất bản.");
    await audit(user.id, "faq.unpublished", path[2]);
    return { ok: true };
  }
  if (path[0] === "admin" && path[1] === "faqs") {
    const input = await jsonBody(
      request,
      z.object({
        id: z.string().uuid().optional(),
        question: z.string().trim().min(5).max(300),
        answer: z.string().trim().min(5).max(5000),
        topic: z.string().min(1).max(80),
        sourceChunk: z.string().min(1).max(100).nullable().optional(),
        status: z.enum(["draft", "published"]),
      }),
    );
    const source = input.sourceChunk
      ? await row(
          "SELECT c.id FROM chunks c JOIN documents d ON d.active_revision=c.revision_id WHERE c.id=? AND d.deleted_at IS NULL",
          input.sourceChunk,
        )
      : null;
    if (input.status === "published" && !source)
      throw new HttpError(
        400,
        "Cần chọn đoạn nguồn đang xuất bản trước khi lưu FAQ.",
      );
    if (
      input.status === "draft" &&
      input.sourceChunk &&
      !(await row("SELECT id FROM chunks WHERE id=?", input.sourceChunk))
    )
      throw new HttpError(400, "Đoạn nguồn không tồn tại.");
    const key = input.id || id();
    await db()
      .prepare(
        "INSERT INTO faqs VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,answer=excluded.answer,topic=excluded.topic,source_chunk=excluded.source_chunk,status=excluded.status,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
      .run(
        key,
        input.question,
        input.answer,
        input.topic,
        input.sourceChunk || null,
        input.status,
        user.id,
        now(),
      );
    await audit(user.id, `faq.${input.status}`, key);
    return { id: key };
  }
  throw new HttpError(404, "Không tìm thấy thao tác.");
};

// Mục đích file: Xử lý cấp quyền và hoàn tất upload tài liệu lên kho lưu trữ cloud.
import { z } from "zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { get, del } from "@vercel/blob";
import { db, id, row } from "./db";
import { maxUploadBytes } from "./config";
import { HttpError, jsonBody, rateLimit, sameOrigin, session } from "./http";
import { saveRevision } from "./knowledge";
import { uploadSourceUrl } from "./source-metadata";
import { docxMime, uploadMime } from "./document-format";

// Giới hạn tiêu đề, phạm vi và tên file trước khi cấp quyền upload.
const metadata = z.object({
  title: z.string().trim().min(5).max(250),
  topic: z.string().min(1).max(80),
  scope: z.string().trim().min(10).max(1500),
  issuedOn: z.string().max(10).optional(),
  effectiveFrom: z.string().max(10).optional(),
  effectiveUntil: z.string().max(10).optional(),
  scopeKey: z.string().trim().max(120).optional(),
  documentId: z.string().max(100).optional(),
  url: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  filename: z.string().min(1).max(250),
});
type Grant = {
  id: string;
  user_id: string;
  pathname: string;
  filename: string;
  metadata_json: string;
  expires_at: number;
  revision_id: string | null;
  lease_until: number | null;
};
export async function createUpload(request: Request) {
  // Chỉ admin có phiên hợp lệ được xin quyền upload; áp dụng giới hạn tần suất.
  sameOrigin(request);
  const { user } = await session(request.headers, true);
  await rateLimit(`upload:${user.id}`, 30, 3600);
  const input = await jsonBody(request, metadata);
  input.url = uploadSourceUrl(input.url);
  // Chỉ cấp đường dẫn upload cho PDF hoặc TXT.
  const extension = input.filename.toLowerCase().endsWith(".pdf")
    ? "pdf"
    : input.filename.toLowerCase().endsWith(".txt")
      ? "txt"
      : /\.(md|markdown)$/i.test(input.filename)
        ? "md"
      : input.filename.toLowerCase().endsWith(".docx")
        ? "docx"
        : null;
  if (!extension) throw new HttpError(415, "Chỉ nhận PDF, DOCX, TXT hoặc Markdown.");
  // Sinh đường dẫn riêng cho lượt upload để tránh ghi đè file khác.
  const key = id(),
    pathname = `uploads/${user.id}/${key}.${extension}`;
  await db()
    .prepare(
      "INSERT INTO upload_grants(id,user_id,pathname,filename,metadata_json,expires_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      key,
      user.id,
      pathname,
      input.filename,
      JSON.stringify(input),
      Date.now() + 15 * 60000,
    );
  return {
    id: key,
    pathname,
    contentType:
      extension === "pdf"
        ? "application/pdf"
        : extension === "docx"
          ? docxMime
          : extension === "md" ? "text/markdown" : "text/plain",
  };
}
export async function uploadToken(request: Request) {
  const body = await jsonBody(
    request,
    z.object({ type: z.string(), payload: z.unknown() }).passthrough(),
  );
  return handleUpload({
    request,
    body: body as HandleUploadBody,
    onBeforeGenerateToken: async (pathname, payload) => {
      sameOrigin(request);
      const { user } = await session(request.headers, true);
      const grant = await row<Grant>(
        "SELECT * FROM upload_grants WHERE id=? AND user_id=?",
        payload || "",
        user.id,
      );
      if (
        !grant ||
        grant.pathname !== pathname ||
        grant.expires_at < Date.now() ||
        grant.revision_id
      )
        throw new HttpError(403, "Phiên tải lên không hợp lệ hoặc đã hết hạn.");
      return {
        allowedContentTypes: ["application/pdf", "text/plain", "text/markdown", docxMime],
        maximumSizeInBytes: maxUploadBytes,
        validUntil: grant.expires_at,
        addRandomSuffix: false,
        allowOverwrite: false,
      };
    },
  });
}
export async function completeUpload(request: Request) {
  sameOrigin(request);
  const { user } = await session(request.headers, true);
  const input = await jsonBody(request, z.object({ id: z.string().uuid() }));
  const grant = await db().transaction(async () => {
    const saved = await row<Grant>(
      "SELECT * FROM upload_grants WHERE id=? AND user_id=?",
      input.id,
      user.id,
    );
    if (!saved || saved.expires_at < Date.now())
      throw new HttpError(404, "Phiên tải lên đã hết hạn.");
    if (saved.revision_id) return saved;
    if (saved.lease_until && saved.lease_until > Date.now())
      throw new HttpError(409, "Tài liệu đang được xác nhận.");
    await db()
      .prepare("UPDATE upload_grants SET lease_until=? WHERE id=?")
      .run(Date.now() + 180000, input.id);
    return saved;
  })();
  if (grant.revision_id) {
    const revision = await row<{ document_id: string }>(
      "SELECT document_id FROM revisions WHERE id=?",
      grant.revision_id,
    );
    return { documentId: revision?.document_id, revisionId: grant.revision_id };
  }
  try {
    const blob = await get(grant.pathname, {
      access: "private",
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200 || blob.blob.size > maxUploadBytes)
      throw new HttpError(400, "Không tìm thấy file hợp lệ.");
    const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (buffer.length > maxUploadBytes)
      throw new HttpError(413, "File lớn hơn 20 MB.");
    const mime = uploadMime(grant.filename, buffer);
    const result = await saveRevision(
      {
        ...metadata.parse(JSON.parse(grant.metadata_json)),
        kind: "upload",
        mime,
        bytes: buffer,
      },
      user.id,
    );
    await db()
      .prepare(
        "UPDATE upload_grants SET revision_id=?,lease_until=NULL WHERE id=?",
      )
      .run(result.revisionId, grant.id);
    await del(grant.pathname).catch(() => {});
    return result;
  } catch (error) {
    await db()
      .prepare("UPDATE upload_grants SET lease_until=NULL WHERE id=?")
      .run(grant.id);
    throw error;
  }
}

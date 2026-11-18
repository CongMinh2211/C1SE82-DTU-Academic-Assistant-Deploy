import { notificationPreferences } from "@/server/notifications";
import { exportConversations } from "@/server/privacy";
import { mailConfig } from "@/server/mail";
import { adminUsersPage } from "@/server/queries/admin-users";
// Mục đích file: Cung cấp dữ liệu đọc cho sinh viên và quản trị, kiểm tra quyền trước khi trả nội dung riêng tư.
import { dashboardStats } from "@/server/queries/admin-stats";
import { usageTopics } from "@/lib/usage";
import { usageReport, usageWindow } from "@/server/usage";
import { adminAuditPage } from "@/server/admin-audit";
import { cloudSourceStorage } from "@/server/source-storage";
import { openSource } from "@/server/source-storage";
import { HttpError, session } from "@/server/http";
import { audit, row, rows } from "@/server/db";
import { documentList } from "@/server/queries/documents";
import { conversationDetail } from "@/server/chat";
import { feedbackContext } from "@/server/feedback";
import { historyPage } from "@/server/conversations";
import type { Citation } from "@/lib/contracts";

function parts(request: Request) {
  return new URL(request.url).pathname.slice("/api/app/".length).split("/");
}

export const getResource = async (request: Request) => {
  // Mọi nhánh trong API này yêu cầu phiên hợp lệ trước khi đọc dữ liệu.
  const path = parts(request),
    { user } = await session(request.headers);
  if (path[0] === "notification-preferences" && !path[1]) return notificationPreferences(user.id);
  if (path[0] === "voice-config") return {serverEnabled: !!process.env.GEMINI_API_KEY?.trim()};
  if (path[0] === "me") return { user, canResetPassword: !!mailConfig() };
  if (path[0] === "language-preferences" && !path[1]) {
    const preference = await row<{ui_language:string;answer_language:string}>("SELECT ui_language,answer_language FROM user_language_preferences WHERE user_id=?", user.id);
    return preference ? {...preference, exists:true} : {ui_language:"vi", answer_language:"auto", exists:false};
  }
  if (path[0] === "conversations") {
    if (path[1] === "export" && !path[2]) return exportConversations(user.id);
    // Chi tiết và danh sách hội thoại đều được giới hạn theo ID người dùng hiện tại.
    if (path[1]) return await conversationDetail(path[1], user.id);
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "history")
      return await historyPage(
        user.id,
        params.get("trash") === "1",
        params.get("q") || "",
        Math.max(1, Number(params.get("page")) || 1),
      );
    return await rows(
      "SELECT * FROM conversations WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200",
      user.id,
    );
  }
  if (path[0] === "feedback" && path[1] === "context" && path[2]) {
    return feedbackContext(path[2], user.id);
  }
  if (path[0] === "feedback" && path[1] && !path[2]) {
    const feedback = await row("SELECT * FROM feedback WHERE id=? AND user_id=?", path[1], user.id);
    if (!feedback) throw new HttpError(404, "Không tìm thấy góp ý.");
    return feedback;
  }
  if (path[0] === "feedback" && !path[1])
    return await rows(
      "SELECT * FROM feedback WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
      user.id,
    );
  // Sinh viên chỉ nhận FAQ đã xuất bản có đoạn nguồn thuộc tài liệu còn hoạt động.
  if (path[0] === "faqs")
    return await rows(
      `SELECT f.*,r.title_snapshot source_title,c.page FROM faqs f LEFT JOIN chunks c ON c.id=f.source_chunk LEFT JOIN revisions r ON r.id=c.revision_id LEFT JOIN documents d ON d.id=c.document_id WHERE f.status='published' AND d.active_revision=c.revision_id AND d.deleted_at IS NULL ORDER BY f.updated_at DESC`,
    );
  if (path[0] === "faq-source" && path[1]) {
    // Tìm nguồn gắn với FAQ và kiểm tra lại trạng thái xuất bản trước khi trả tài liệu.
    const source = await row<{
      id: string;
      document_id: string;
      revision_id: string;
      title_snapshot: string;
      scope_snapshot: string;
      source_url: string | null;
      version: number;
      page: number;
      page_end: number;
      section: string;
      text: string;
      pages_json: string;
      raw_path: string;
      mime: string;
    }>(
      "SELECT c.*,r.title_snapshot,r.scope_snapshot,r.source_url,r.version,r.pages_json,r.raw_path,r.mime FROM faqs f JOIN chunks c ON c.id=f.source_chunk JOIN revisions r ON r.id=c.revision_id JOIN documents d ON d.active_revision=c.revision_id WHERE f.id=? AND f.status='published' AND d.deleted_at IS NULL",
      path[1],
    );
    if (!source)
      throw new HttpError(404, "FAQ hoặc nguồn không còn được xuất bản.");
    // Trả file để trình duyệt mở trực tiếp; dữ liệu dạng chữ được khai báo UTF-8.
    if (path[2] === "file")
      return new Response(await openSource(source.raw_path), {
        headers: {
          "Content-Type": source.mime.startsWith("text/")
            ? `${source.mime}; charset=utf-8`
            : source.mime,
          "Content-Disposition": `inline; filename="source-${source.document_id}.${source.mime === "application/pdf" ? "pdf" : source.mime === "text/html" ? "html" : source.mime.includes("wordprocessingml") ? "docx" : source.mime === "text/markdown" ? "md" : "txt"}"`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    return {
      mime: source.mime,
      citation: {
        id: "1",
        chunkId: source.id,
        documentId: source.document_id,
        revisionId: source.revision_id,
        title: source.title_snapshot,
        scope: source.scope_snapshot,
        version: source.version,
        page: source.page,
        pageEnd: source.page_end,
        section: source.section,
        quote: source.text,
        ...(source.source_url ? { url: source.source_url } : {}),
      },
      pages: JSON.parse(source.pages_json).filter(
        (p: { page: number }) =>
          p.page >= source.page && p.page <= source.page_end,
      ),
    };
  }
  if (path[0] === "sources" && path[1] && path[2]) {
    // Chỉ chủ hội thoại còn hoạt động mới được đọc trích dẫn của tin nhắn.
    const message = await row<{
      citations_json: string;
      conversation_id: string;
    }>(
      "SELECT m.citations_json,m.conversation_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=? AND c.deleted_at IS NULL",
      path[1],
      user.id,
    );
    // Dùng ID trích dẫn đã lưu trong câu trả lời, không nhận đường dẫn file do client tự chỉ định.
    const citation = (
      JSON.parse(message?.citations_json || "[]") as Citation[]
    ).find((c) => c.id === path[2]);
    if (!citation)
      throw new HttpError(404, "Không tìm thấy nguồn của câu trả lời này.");
    // Nguồn web đã có trích đoạn và URL, không đọc file trong kho tài liệu.
    if (citation.documentId === "web")
      return {
        citation,
        conversationId: message?.conversation_id,
        pages: [{ page: citation.page, text: citation.quote }],
        web: true,
      };
    // Nguồn file được mở theo phiên bản đã lưu trong trích dẫn để giữ đúng lịch sử.
    const revision = await row<{
      pages_json: string;
      raw_path: string;
      mime: string;
    }>(
      "SELECT pages_json,raw_path,mime FROM revisions WHERE id=?",
      citation.revisionId,
    );
    if (!revision) throw new HttpError(404, "Không tìm thấy phiên bản nguồn.");
    if (path[3] === "file")
      return new Response(await openSource(revision.raw_path), {
        headers: {
          "Content-Type": revision.mime.startsWith("text/")
            ? `${revision.mime}; charset=utf-8`
            : revision.mime,
          "Content-Disposition": `inline; filename="source-${citation.documentId}.${revision.mime === "application/pdf" ? "pdf" : revision.mime === "text/html" ? "html" : revision.mime.includes("wordprocessingml") ? "docx" : revision.mime === "text/markdown" ? "md" : "txt"}"`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    return {
      citation,
      mime: revision.mime,
      conversationId: message?.conversation_id,
      pages: JSON.parse(revision.pages_json).filter(
        (p: { page: number }) =>
          p.page >= citation.page && p.page <= citation.pageEnd,
      ),
    };
  }
  if (path[0] === "admin") {
    // Dữ liệu quản trị yêu cầu kiểm tra quyền admin bổ sung.
    await session(request.headers, true);
    if (path[1] === "crawl-schedules") return {items:await rows("SELECT id,start_url,topic,scope,interval_hours,max_pages,enabled,next_run,last_run,last_status,last_message FROM crawl_schedules ORDER BY created_at DESC LIMIT 100")};
    if (path[1] === "audit" && path[2] && path[3] === "source" && path[4]) {
      // Chỉ mở file thuộc citation đã lưu trong lượt hỏi và hội thoại chưa xóa.
      const message = await row<{ citations_json: string }>(
        "SELECT m.citations_json FROM traces t JOIN conversations c ON c.id=t.conversation_id JOIN messages m ON m.trace_id=t.id AND m.role='assistant' WHERE t.id=? AND c.deleted_at IS NULL",
        path[2],
      );
      const citation = (
        JSON.parse(message?.citations_json || "[]") as Citation[]
      ).find((item) => item.id === path[4]);
      if (!citation || citation.documentId === "web")
        throw new HttpError(404, "Không tìm thấy nguồn tài liệu.");
      const revision = await row<{ raw_path: string; mime: string }>(
        "SELECT raw_path,mime FROM revisions WHERE id=? AND document_id=?",
        citation.revisionId,
        citation.documentId,
      );
      if (!revision)
        throw new HttpError(404, "Không tìm thấy phiên bản tài liệu.");
      await audit(user.id, "question.source_viewed", path[2], {
        citationId: citation.id,
      });
      return new Response(await openSource(revision.raw_path), {
        headers: {
          "Content-Type": revision.mime.startsWith("text/")
            ? `${revision.mime}; charset=utf-8`
            : revision.mime,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    }
    if (path[1] === "analytics") {
      const params = new URL(request.url).searchParams;
      const days = Number(params.get("days") || 7),
        topic = params.get("topic") || "";
      if (
        ![7, 30, 90].includes(days) ||
        (topic && !usageTopics.includes(topic))
      )
        throw new HttpError(400, "Bộ lọc thống kê chưa hợp lệ.");
      return await usageReport(days, topic);
    }
    if (path[1] === "upload-config") return { direct: cloudSourceStorage() };
    if (path[1] === "documents")
      return path[2]
        ? {
            document: (await documentList()).find(
              (d) =>
                (
                  d as {
                    id: string;
                  }
                ).id === path[2],
            ),
            revisions: await rows(
              "SELECT id,version,status,chunk_count,error,created_at,published_at,issued_on,effective_from,effective_until,scope_key FROM revisions WHERE document_id=? ORDER BY version DESC",
              path[2],
            ),
          }
        : await documentList();
    if (path[1] === "revision" && path[2]) {
      const revision = await row<{
        pages_json: string;
        mime: string;
        id: string;
        title_snapshot: string;
        status: string;
      }>(
        "SELECT id,title_snapshot,status,pages_json,mime FROM revisions WHERE id=?",
        path[2],
      );
      if (!revision) throw new HttpError(404, "Không tìm thấy nguồn.");
      const chunks = await rows(
        "SELECT id,page,section,text FROM chunks WHERE revision_id=? ORDER BY page,rowid",
        path[2],
      );
      return {
        ...revision,
        pages: JSON.parse(revision.pages_json || "[]"),
        chunks,
      };
    }
    if (path[1] === "jobs-summary") {
      const today = usageWindow(1);
      const counts = await rows<{
        status: string;
        n: number;
      }>(
        "SELECT j.status,count(*) n FROM jobs j JOIN revisions r ON r.id=j.revision_id JOIN documents d ON d.id=r.document_id WHERE d.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM jobs newer WHERE newer.revision_id=j.revision_id AND (newer.created_at>j.created_at OR (newer.created_at=j.created_at AND newer.id>j.id))) GROUP BY j.status",
      );
      const done = await row<{
        n: number;
      }>(
        "SELECT count(*) n FROM jobs j JOIN revisions r ON r.id=j.revision_id JOIN documents d ON d.id=r.document_id WHERE d.deleted_at IS NULL AND j.status='done' AND j.finished_at>=? AND j.finished_at<?",
        today.start,
        today.end,
      );
      return {
        queued: counts.find((c) => c.status === "queued")?.n || 0,
        running: counts.find((c) => c.status === "running")?.n || 0,
        failed: counts.find((c) => c.status === "failed")?.n || 0,
        completedToday: done?.n || 0,
      };
    }
    if (path[1] === "jobs") {
      const { recoverQueuedJobs } = await import("@/server/cloud-index");
      await recoverQueuedJobs();
      return await rows(
        "SELECT j.*,d.id document_id,d.title,d.active_revision,r.version,r.status revision_status FROM jobs j JOIN revisions r ON r.id=j.revision_id JOIN documents d ON d.id=r.document_id WHERE d.deleted_at IS NULL ORDER BY j.created_at DESC,j.id DESC LIMIT 100",
      );
    }
    if (path[1] === "feedback")
      return await rows(
        `SELECT f.*,u.name user_name,m.content answer_content,m.citations_json answer_citations,(SELECT content FROM messages WHERE conversation_id=m.conversation_id AND role='user' AND created_at<=m.created_at ORDER BY created_at DESC,rowid DESC LIMIT 1) question FROM feedback f JOIN user u ON u.id=f.user_id LEFT JOIN messages m ON m.id=f.message_id ORDER BY f.created_at DESC LIMIT 200`,
      );
    if (path[1] === "faqs")
      return await rows(
        "SELECT f.*,r.title_snapshot source_title,c.page,c.revision_id source_revision,c.text source_quote,r.scope_snapshot source_scope,CASE WHEN d.active_revision=c.revision_id AND d.deleted_at IS NULL THEN 1 ELSE 0 END source_active FROM faqs f LEFT JOIN chunks c ON c.id=f.source_chunk LEFT JOIN revisions r ON r.id=c.revision_id LEFT JOIN documents d ON d.id=c.document_id ORDER BY f.updated_at DESC",
      );
    if (path[1] === "users")
      return adminUsersPage(new URL(request.url).searchParams);
    if (path[1] === "audit" && new URL(request.url).searchParams.has("view"))
      return await adminAuditPage(new URL(request.url).searchParams);
    if (path[1] === "audit")
      return {
        events: await rows(
          "SELECT a.*,u.name actor_name FROM audit a LEFT JOIN user u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200",
        ),
        traces: await rows(
          "SELECT * FROM traces ORDER BY created_at DESC LIMIT 100",
        ),
      };
    if (path[1] === "stats") return dashboardStats();
  }
  throw new HttpError(404, "Không tìm thấy dữ liệu.");
};

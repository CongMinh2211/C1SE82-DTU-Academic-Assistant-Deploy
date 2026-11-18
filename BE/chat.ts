// Mục đích file: Xử lý một lượt chat: xác thực, lưu hội thoại, gọi tra cứu và lưu kết quả cùng trích dẫn.
import { z } from "zod";
import { db, row, rows, now, id } from "./db";
import { HttpError, jsonBody, rateLimit, sameOrigin, session } from "./http";

import type { Message } from "@/lib/contracts";
import { attachBankDetails } from "./rag/fee-bank-details";
import { isEnglish } from "./rag/dialogue";
type StoredMessage = Omit<Message, "citations"> & {
  citations_json: string;
};
export async function conversationDetail(
  conversationId: string,
  userId: string,
) {
  // Chỉ tìm hội thoại còn hoạt động của chính người đang đăng nhập.
  const conversation = await row<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM conversations WHERE id=? AND user_id=? AND deleted_at IS NULL",
    conversationId,
    userId,
  );
  if (!conversation) throw new HttpError(404, "Không tìm thấy hội thoại.");
  // Khôi phục danh sách citation từ JSON theo đúng thứ tự tin nhắn đã lưu.
  const messages = (
    await rows<StoredMessage>(
      "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at,rowid",
      conversationId,
    )
  ).map(({ citations_json, ...m }) => ({
    ...m,
    citations: JSON.parse(citations_json),
  }));
  return { ...conversation, messages };
}
export async function chat(request: Request) {
  // Xác thực người gửi và kiểm tra dữ liệu đầu vào trước khi tạo lượt hỏi.
  sameOrigin(request);
  const { user } = await session(request.headers);
  const input = await jsonBody(
    request,
    z.object({
      question: z.string().trim().min(1).max(2500),
      conversationId: z.string().uuid().optional(),
      requestId: z.string().uuid(),
      useWeb: z.boolean().default(true),
      documentOnly: z.boolean().default(false),
      answerLanguage: z.enum(["auto", "vi", "en", "hi"]).optional(),
    }),
  );
  // requestId giúp thao tác gửi lại không tạo thêm một lượt hỏi trùng lặp.
  const prior = await row<{
    conversation_id: string;
    status: string;
  }>(
    "SELECT m.conversation_id,m.status FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=?",
    input.requestId,
    user.id,
  );
  if (prior) {
    // Lượt đang xử lý báo xung đột; lượt xong trả lại lịch sử thay vì gọi AI lần nữa.
    if (prior.status === "processing")
      throw new HttpError(409, "Câu hỏi đang được xử lý.");
    return await conversationDetail(prior.conversation_id, user.id);
  }
  // Áp dụng giới hạn theo người dùng sau khi loại các lần gửi lại cùng requestId.
  await rateLimit(`chat:${user.id}`, 20, 3600);
  const conversationId = input.conversationId || id();
  if (input.conversationId) await conversationDetail(conversationId, user.id);
  // Chỉ lấy một phần lịch sử của chính người dùng để duy trì ngữ cảnh và giới hạn dữ liệu gửi AI.
  const history = input.conversationId
    ? (await conversationDetail(conversationId, user.id)).messages
        .filter((m) => m.status !== "processing" && m.status !== "error")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 3500) }))
    : [];
  // Lưu câu hỏi và trạng thái đang xử lý trong cùng giao dịch để tránh ghi thiếu lượt chat.
  const traceId = id();
  await db().transaction(async () => {
    // Dọn lease hết hạn trước khi kiểm tra số lượt đang xử lý đồng thời.
    await db()
      .prepare("DELETE FROM chat_leases WHERE expires_at<?")
      .run(Date.now());
    if (
      ((
        await row<{
          n: number;
        }>("SELECT count(*) n FROM chat_leases")
      )?.n || 0) >= 4
    )
      throw new HttpError(
        429,
        "Hệ thống đang xử lý nhiều câu hỏi. Vui lòng thử lại sau ít phút.",
      );
    if (await row("SELECT user_id FROM chat_leases WHERE user_id=?", user.id))
      throw new HttpError(
        409,
        "Bạn đang có một câu hỏi được xử lý. Vui lòng chờ.",
      );
    await db()
      .prepare("INSERT INTO chat_leases VALUES (?,?)")
      .run(user.id, Date.now() + 150000);
    if (!input.conversationId)
      await db()
        .prepare(
          "INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
        )
        .run(
          conversationId,
          user.id,
          input.question.slice(0, 100),
          now(),
          now(),
        );
    await db()
      .prepare(
        "INSERT INTO messages(id,conversation_id,role,content,status,created_at) VALUES (?,?,'user',?,'saved',?)",
      )
      .run(id(), conversationId, input.question, now());
    await db()
      .prepare(
        "INSERT INTO messages(id,conversation_id,role,status,trace_id,created_at) VALUES (?,?,'assistant','processing',?,?)",
      )
      .run(input.requestId, conversationId, traceId, now());
    await db()
      .prepare(
        "INSERT INTO traces(id,user_id,conversation_id,question,status,created_at) VALUES (?,?,?,?,'processing',?)",
      )
      .run(traceId, user.id, conversationId, input.question, now());
  })();
  const started = Date.now();
  try {
    // Dừng xử lý nếu người dùng hủy yêu cầu hoặc vượt thời gian cho phép.
    const runSignal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(120000),
    ]);
    const { answerQuestion } = await import("./rag/answer");
    const rawAnswer = await answerQuestion(
      input.question,
      history,
      input.documentOnly ? false : input.useWeb,
      runSignal,
      input.documentOnly,
    );
    // Bổ sung tài khoản ngân hàng có nguồn và phạm vi học kỳ phù hợp khi cần.
    const answer = input.documentOnly ? rawAnswer : attachBankDetails(input.question, rawAnswer);
    const english = isEnglish(input.question);
    const webNote =
      !input.documentOnly && input.useWeb && ["unavailable", "no_results"].includes(answer.webStatus)
        ? `\n\n${answer.webStatus === "unavailable" ? (english ? "Web search is temporarily unavailable." : "Tìm kiếm web tạm thời không khả dụng.") : (english ? "No suitable web source was found to cite." : "Chưa tìm thấy trang web liên quan đủ phù hợp để trích dẫn.")}`
        : !input.documentOnly && input.useWeb && answer.webCoverage === "university_only"
          ? (english ? "\n\nWeb search is partially unavailable; this answer uses accessible sources." : "\n\nTìm kiếm toàn web đang gián đoạn; câu trả lời dùng các nguồn còn truy cập được.")
          : "";
    // Dịch sau khi câu trả lời đã gắn nguồn; khi không kiểm chứng được bản dịch, giữ nguyên bản gốc.
    const { translateAnswer } = await import("./rag/translate-answer");
    const preference = await row<{answer_language:"auto"|"vi"|"en"|"hi"}>("SELECT answer_language FROM user_language_preferences WHERE user_id=?", user.id);
    const rendered = await translateAnswer(answer.content + webNote, input.answerLanguage || preference?.answer_language || "auto", runSignal);
    const qualityNote = answer.review
      ? `;review:${JSON.stringify({
          attempt: answer.review.attempt,
          complete: answer.review.complete,
          failed: answer.review.checks
            .filter((c) => !c.supported)
            .slice(0, 3)
            .map((c) => ({ index: c.index, reason: c.reason.slice(0, 180) })),
        })}`
      : answer.dialogueReview?.some((c) => !c.allowed)
        ? `;dialogue:${JSON.stringify(answer.dialogueReview.filter((c) => !c.allowed).map((c) => c.reason.slice(0, 180)))}`
        : "";
    await db().transaction(async () => {
      await db()
        .prepare(
          "UPDATE messages SET content=?,status=?,citations_json=? WHERE id=?",
        )
        .run(
          rendered.text,
          answer.status,
          JSON.stringify(answer.citations),
          input.requestId,
        );
      await db()
        .prepare(
          "UPDATE traces SET status=?,retrieval_json=?,model=?,latency_ms=?,reason=? WHERE id=?",
        )
        .run(
          answer.status,
          JSON.stringify(answer.retrieval),
          answer.reason === "approved_faq"
            ? "approved-faq"
            : answer.reason === "structured_tuition"
              ? "source-table"
              : "ai-provider",
          Date.now() - started,
          `${answer.reason};web:${answer.webStatus};coverage:${answer.webCoverage || "none"}${qualityNote}${answer.validationErrors?.length ? `;validation:${answer.validationErrors.join(",")}` : ""}`,
          traceId,
        );
      await db()
        .prepare("UPDATE conversations SET updated_at=? WHERE id=?")
        .run(now(), conversationId);
    })();
    return await conversationDetail(conversationId, user.id);
  } catch {
    await db()
      .prepare("UPDATE messages SET content=?,status='error' WHERE id=?")
      .run(
        request.signal.aborted
          ? "Yêu cầu đã dừng trước khi hoàn tất. Bạn có thể gửi lại câu hỏi."
          : "Không thể xử lý câu hỏi lúc này. Vui lòng thử lại sau.",
        input.requestId,
      );
    await db()
      .prepare(
        "UPDATE traces SET status='error',reason=?,latency_ms=? WHERE id=?",
      )
      .run(
        request.signal.aborted ? "cancelled" : "retrieval_or_provider_failure",
        Date.now() - started,
        traceId,
      );
    return await conversationDetail(conversationId, user.id);
  } finally {
    await db().prepare("DELETE FROM chat_leases WHERE user_id=?").run(user.id);
  }
}

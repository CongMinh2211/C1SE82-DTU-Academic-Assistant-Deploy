import type { Answer } from "./answer";
import type { Evidence } from "./retrieve";

// Bảo vệ chế độ chỉ đọc tài liệu ở máy chủ, kể cả khi frontend gửi sai cờ tìm web.
export async function answerFromDocuments(question: string, deps: {
  faq: (question: string) => Promise<Answer | null>;
  resolve: (question: string) => Promise<string>;
  retrieve: (question: string) => Promise<Evidence[]>;
  ground: (question: string, evidence: Evidence[]) => Promise<Answer>;
  fallback: (reason: string) => Answer;
}): Promise<Answer> {
  const faq = await deps.faq(question);
  if (faq && faq.citations.length && faq.citations.every(c => c.documentId !== "web")) return faq;
  const resolved = await deps.resolve(question);
  const evidence = (await deps.retrieve(resolved)).filter(item => item.documentId !== "web");
  if (!evidence.length) return deps.fallback("no_document_evidence");
  const answer = await deps.ground(resolved, evidence);
  // Chặn cả câu trả lời không có citation và citation web khi chỉ cho phép tài liệu.
  if (answer.status === "answered" && (!answer.citations.length || answer.citations.some(c => c.documentId === "web"))) return deps.fallback("invalid_document_citation");
  return answer;
}

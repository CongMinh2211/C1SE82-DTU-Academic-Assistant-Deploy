// Mục đích file: Tìm FAQ đã duyệt trùng câu hỏi và trả lời trực tiếp khi nguồn tham chiếu còn hoạt động.
import { EvidenceCache } from "./evidence-cache";
import { universityDate } from "./date";
import { isPreferredSource } from "./source-preference";
import { currentlyUsable } from "./source-validity";
import { rows } from "../db";
import { normalize } from "./parser";
import type { Answer } from "./answer";

type ApprovedFaq = {
  question: string;
  answer: string;
  chunk_id: string;
  document_id: string;
  revision_id: string;
  title: string;
  version: number;
  page: number;
  page_end: number;
  section: string;
  text: string;
  scope: string;
  source_url: string | null;
  issued_on?: string | null; effective_from?: string | null; effective_until?: string | null; scope_key?: string | null;
};

const faqCache = new EvidenceCache<Answer | null>();

// Chỉ ghép câu hỏi trùng sau khi chuẩn hóa dấu câu; không đoán ý cho FAQ khác.
export function faqQuestionKey(value: string) {
  // Bỏ dấu và chuyển chữ thường, sau đó thay dấu câu bằng khoảng trắng để so khớp ổn định.
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function approvedFaqAnswer(
  question: string,
  candidates: ApprovedFaq[],
): Answer | null {
  // Câu rỗng không thể dùng để xác định FAQ.
  const key = faqQuestionKey(question);
  if (!key) return null;
  // So khớp chính xác sau chuẩn hóa; không dùng FAQ chỉ vì hai câu hỏi gần giống nhau.
  const matches = candidates.filter(
    (item) => faqQuestionKey(item.question) === key,
  );
  // Hai câu trả lời khác nhau cho cùng câu hỏi cần được kiểm tra, không chọn ngẫu nhiên.
  if (
    matches.length !== 1 ||
    !matches[0].answer.trim() ||
    !matches[0].text.trim()
  )
    return null;
  // Trả nguyên câu trả lời đã duyệt và gắn đoạn nguồn thay vì gọi mô hình.
  const source = matches[0];
  return {
    content: `${source.answer.trim()} [1]`,
    status: "answered",
    reason: "approved_faq",
    webStatus: "not_needed",
    retrieval: [],
    citations: [
      {
        id: "1",
        chunkId: source.chunk_id,
        documentId: source.document_id,
        revisionId: source.revision_id,
        title: source.title,
        version: source.version,
        page: source.page,
        pageEnd: source.page_end,
        section: source.section,
        quote: source.text,
        scope: source.scope,
        ...(source.source_url ? { url: source.source_url } : {}),
      },
    ],
  };
}

export async function lookupApprovedFaq(question: string) {
  // Chỉ lấy FAQ đã công bố có đoạn nguồn thuộc phiên bản tài liệu hiện đang hoạt động.
  const candidates =
    await rows<ApprovedFaq>(`SELECT f.question,f.answer,c.id chunk_id,c.document_id,c.revision_id,
    c.page,c.page_end,c.section,c.text,r.title_snapshot title,r.scope_snapshot scope,r.version,r.source_url,r.issued_on,r.effective_from,r.effective_until,r.scope_key
    FROM faqs f JOIN chunks c ON c.id=f.source_chunk JOIN revisions r ON r.id=c.revision_id
    JOIN documents d ON d.id=c.document_id AND d.active_revision=c.revision_id
    WHERE f.status='published' AND d.deleted_at IS NULL AND r.status='published'`);
  // Luôn đọc trạng thái FAQ và nguồn hiện hành. Phiên bản mới trong cùng phạm vi cũng phải làm thay đổi khóa cache.
  const liveSources = await rows<{id:string;issued_on:string|null;effective_from:string|null;effective_until:string|null;scope_key:string|null}>("SELECT r.id,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM revisions r JOIN documents d ON d.active_revision=r.id AND r.document_id=d.id WHERE d.deleted_at IS NULL AND r.status='published' ORDER BY r.id");
  // Ngày, nội dung FAQ và metadata phiên bản đều tham gia khóa để thay đổi nguồn không giữ cache cũ.
  const fingerprint = [universityDate(), candidates, liveSources];
  return faqCache.get(faqQuestionKey(question), fingerprint, async () => {
    const eligible = candidates.filter(currentlyUsable);
    // Sau lọc thời gian, kiểm tra thêm nguồn ưu tiên trong cùng phạm vi trước khi trả lời.
    const preferred = await Promise.all(eligible.map(source => isPreferredSource(source, question)));
    return approvedFaqAnswer(question, eligible.filter((_, index) => preferred[index]));
  });
}

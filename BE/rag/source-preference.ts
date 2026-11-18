// Không dùng nhánh trả lời nhanh khi đã có nguồn mới hơn trong cùng phạm vi được xác minh.
import { rows } from "../db";
import { currentlyUsable } from "./source-validity";
type VersionDates = { issued_on?: string | null; effective_from?: string | null; effective_until?: string | null; scope_key?: string | null };
export async function isPreferredSource(source: VersionDates, question: string): Promise<boolean> {
  // Năm cụ thể phải được xử lý theo phạm vi lịch sử, không mặc định thay bằng bản mới nhất.
  // Nguồn chưa đủ ngày không đi đường trả lời nhanh: chuyển sang RAG để giải thích giới hạn.
  if (!source.issued_on || !source.effective_from || !source.effective_until) return false;
  if (/\b20\d{2}\b/.test(question) || !source.scope_key) return true;
  const versions = await rows<VersionDates>(`SELECT r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM revisions r JOIN documents d ON d.active_revision=r.id AND r.document_id=d.id WHERE d.deleted_at IS NULL AND r.status='published' AND r.scope_key=?`, source.scope_key);
  return !versions.some(item => item.effective_from && item.effective_until && item.issued_on && item.issued_on! > source.issued_on! && currentlyUsable(item));
}

import { isPreferredSource } from "./source-preference";
import { currentlyUsable } from "./source-validity";
// Mục đích file: Trả lời nhanh câu hỏi chuyển khoản và tiền mặt khi có bản trích dẫn đang được công bố.
import { row } from "../db";
import { normalize } from "./parser";
import { isEnglish } from "./dialogue";
import type { Answer } from "./answer";

export async function paymentGuideAnswer(question: string): Promise<Answer | null> {
  // Phân biệt câu hỏi về nội dung chuyển khoản với câu hỏi về hình thức nộp tiền mặt.
  const q = normalize(question);
  const english = isEnglish(question);
  const transfer = (/\b(?:noi dung|ghi gi|dien gi|ghi noi dung|dien noi dung)\b/.test(q) && /\b(?:hoc phi|chuyen khoan|nop tien)\b/.test(q)) || (english && /\b(?:reference|description|message|memo)\b/.test(q) && /\b(?:tuition|payment|transfer)\b/.test(q));
  const cash = (/\b(?:tien mat)\b/.test(q) && /\b(?:nop|dong|thanh toan|hoc phi)\b/.test(q)) || (english && /\bcash\b/.test(q) && /\b(?:pay|payment|tuition|fees)\b/.test(q));
  if (!transfer && !cash) return null;
  // Chỉ trả lời trực tiếp khi đoạn nguồn đang được công bố có đủ dấu hiệu đã đối chiếu.
  const source = await row<{id:string;document_id:string;revision_id:string;page:number;page_end:number;section:string;text:string;title:string;scope:string;version:number; issued_on?:string|null; effective_from?:string|null; effective_until?:string|null; scope_key?:string|null}>(`SELECT c.id,c.document_id,c.revision_id,c.page,c.page_end,c.section,c.text,r.title_snapshot title,r.scope_snapshot scope,r.version,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM chunks c JOIN revisions r ON r.id=c.revision_id JOIN documents d ON d.id=c.document_id AND d.active_revision=c.revision_id WHERE d.deleted_at IS NULL AND r.status='published' AND r.title_snapshot=? AND lower(c.text) LIKE ? LIMIT 1`, "Trích dẫn hướng dẫn nộp học phí và VietinBank - cần đối chiếu", transfer ? "%mã số sinh viên đầy đủ%" : "%vietcombank%");
  // Nếu nguồn chưa được xuất bản, để luồng RAG thông thường tiếp tục xử lý thay vì đoán.
  if (!source || !currentlyUsable(source) || !(await isPreferredSource(source, question))) return null;
  const text = english ? (transfer ? "According to the supplied guide, include your full student ID, full name, tuition payment, semester and academic year in the transfer reference. [1]\n\nExample: [full student ID] Nguyen Van A nop hoc phi HK1 nam hoc 2026-2027. Verify the notice for your semester before transferring." : "The supplied guide describes cash payments at a VietinBank or Vietcombank counter. Provide your student ID, check the amount and keep the receipt. [1]\n\nFor payment at the university, contact admissions or the finance office first; availability for every student at 254 Nguyễn Văn Linh has not been confirmed.") : transfer ? "Theo tài liệu nhóm cung cấp, ghi: MSSV đầy đủ + họ tên + nộp học phí + học kỳ + năm học. [1]\n\nVí dụ: [MSSV đầy đủ] Nguyen Van A nop hoc phi HK1 nam hoc 2026-2027. Đây là ví dụ; đối chiếu thông báo của đúng học kỳ trước khi chuyển khoản." : "Tài liệu nhóm cung cấp hướng dẫn nộp tiền mặt tại quầy VietinBank hoặc Vietcombank. Bạn cung cấp mã sinh viên và kiểm tra số tiền trước khi nộp, rồi giữ chứng từ. [1]\n\nVới việc nộp trực tiếp tại trường, nhất là khi nhập học, hãy hỏi bộ phận tuyển sinh hoặc tài chính trước khi đến 254 Nguyễn Văn Linh; chưa xác nhận địa điểm này đang thu tiền cho mọi đối tượng.";
  return {status:"answered",reason:"payment_guide",webStatus:"not_needed",retrieval:[],content:text,citations:[{id:"1",chunkId:source.id,documentId:source.document_id,revisionId:source.revision_id,title:source.title,version:source.version,page:source.page,pageEnd:source.page_end,section:source.section,quote:source.text,scope:source.scope}]};
}

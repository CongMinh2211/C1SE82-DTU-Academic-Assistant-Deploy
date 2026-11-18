// Mục đích file: Tạo chỉ dẫn tới các cổng DTU cho một số câu hỏi định hướng không cần suy đoán dữ liệu cá nhân.
import { normalize } from "./parser";
import { isEnglish } from "./dialogue";
import type { Answer } from "./answer";

// Chỉ chỉ đường tới cổng và thông báo chính thức; không suy đoán số tài khoản hay kỳ nộp.
export function portalAnswer(question: string): Answer | null {
  const q = normalize(question);
  const english = isEnglish(question);
  const payment = (/\b(?:nop|dong|thanh toan|chuyen khoan|noi dung)\b/.test(q) && /\bhoc phi\b/.test(q) && !/\b(?:bao nhieu|muc phi|don gia|gia tien|so tien|hoc phi la bao nhieu|noi dung|vietinbank|viettinbank|chuyen khoan)\b/.test(q)) || (english && /\b(?:pay|payment|paying)\b/.test(q) && /\b(?:tuition|fees?)\b/.test(q) && !/\b(?:how much|cost|amount|reference|description|content|bank|cash|transfer|deadline|account|vietinbank)\b/.test(q));
  const lookup = (/\b(?:xem|tra cuu|o dau|link|duong dan)\b/.test(q) && /\b(?:lich hoc|bang diem|dang ky mon|dang ky hoc phan)\b/.test(q)) || (english && /\b(?:where|view|find|check|access|register|enrol|enroll)\b/.test(q) && /\b(?:class schedule|class timetable|grades|transcript|register for courses|register for classes|enrol in courses|enroll in courses)\b/.test(q));
  if (!payment && !lookup) return null;
  const url = "https://mydtu.duytan.edu.vn/";
  const notice = "https://hssv.duytan.edu.vn/thong-bao-ag5/thong-bao-ve-viec-nop-hoc-phi-hoc-ky-1-nam-hoc-2026-2027zlkd2";
  return { status: "answered", reason: "official_portal_directory", webStatus: "not_needed", retrieval: [],
    content: english ? (payment ? `Sign in to MyDTU to check your tuition and payment status: ${url} [1]\n\nFor payment methods and transfer details, consult the notice and attachments for semester 1 of 2026–2027: ${notice} [2]. For another semester, check its current notice or contact the finance office or your academic advisor.` : `Sign in to MyDTU to access your academic information: ${url} [1]`) : payment ? "Bạn đăng nhập MyDTU để xem mục Học phí và đối chiếu tình trạng nộp: https://mydtu.duytan.edu.vn/ [1]\n\nXem thông báo nộp học phí học kỳ 1 năm học 2026–2027 và tệp đính kèm để kiểm tra cách nộp, tài khoản và nội dung chuyển khoản: " + notice + " [2]. Nếu bạn cần nộp học kỳ khác, hãy kiểm tra thông báo của đúng học kỳ hoặc hỏi Ban Kế hoạch Tài chính/cố vấn học tập." : "Bạn có thể đăng nhập MyDTU để tra cứu thông tin học tập: https://mydtu.duytan.edu.vn/ [1]",
    citations: [{id:"1",chunkId:`web:${url}`,documentId:"web",revisionId:"web",title:"Cổng MyDTU",version:1,page:1,pageEnd:1,section:"MyDTU",quote:"MyDTU",scope:"Cổng sinh viên DTU",url,sourceTier:"official"},
      ...(payment ? [{id:"2",chunkId:`web:${notice}`,documentId:"web",revisionId:"web",title:"Thông báo học phí HK1 năm 2026–2027",version:1,page:1,pageEnd:1,section:"Thông báo",quote:"Thông báo Về việc nộp Học phí học kỳ 1 năm học 2026-2027",scope:"Học kỳ 1 năm học 2026–2027; nội dung chi tiết nằm trong file đính kèm",url:notice,sourceTier:"official" as const}] : [])] };
}

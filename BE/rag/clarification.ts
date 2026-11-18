// Chỉ hỏi thêm khi câu hỏi thực sự thiếu ý, không che lỗi hệ thống hoặc nguồn thiếu.
import { normalize } from "./parser";
import type { Turn } from "./dialogue";

export function missingQuestionDetail(question: string, history: Turn[] = []): string | null {
  const q = normalize(question).replace(/[?!.,:;]+/g, " ").replace(/\s+/g, " ").trim();
  // Nếu đang hỏi tiếp, để bộ xử lý hội thoại xét cả ngữ cảnh thay vì hỏi lại.
  if (history.some(turn => turn.role === "user")) return null;
  // Học phí chung vẫn có thể tra thông báo và giải thích phạm vi trước khi hỏi chi tiết.
  if (/^(?:cho (?:minh|em|toi) hoi )?(?:ve |thong tin (?:ve )?)?noi quy(?: (?:dtu|nha truong|la gi|the nao|sao))?$/.test(q))
    return "Bạn muốn tìm nội quy lớp học, phòng máy hay nội quy nào khác?";
  if (/^(?:cho (?:minh|em|toi) hoi )?(?:ve |thong tin (?:ve )?)?lich(?: (?:dtu|la gi|the nao|sao))?$/.test(q))
    return "Bạn muốn xem lịch học, lịch thi hay lịch đăng ký học phần?";
  if (/^(?:cho (?:minh|em|toi) hoi )?(?:ve |thong tin (?:ve )?)?(?:dang ky|dang ki)(?: (?:dtu|la gi|the nao|sao))?$/.test(q))
    return "Bạn muốn đăng ký học phần, tài khoản hay thủ tục nào khác?";
  return null;
}

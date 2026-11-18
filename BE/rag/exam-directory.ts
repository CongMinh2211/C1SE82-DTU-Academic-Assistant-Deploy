// Mục đích file: Trả đường dẫn danh sách thi chính thức cho câu hỏi tìm nơi tra cứu; không đoán lịch cá nhân.
import { normalize } from "./parser";
import { isEnglish } from "./dialogue";
import type { Answer } from "./answer";

// Chỉ dẫn đến trang tra cứu, không suy đoán lịch thi hay dữ liệu cá nhân.
export function examDirectoryAnswer(question: string): Answer | null {
  const q = normalize(question);
  const english = isEnglish(question);
  const exam = /\b(?:lich thi|danh sach thi|exam(?:ination)?s?\s+(?:schedule|timetable|list)|(?:schedule|timetable|list)\s+(?:of\s+|for\s+)?(?:exams?|examinations?))\b/.test(q);
  const lookup = /\b(?:o dau|xem|tra cuu|link|duong dan|where|view|find|check|access)\b/.test(q);
  // Trả đường dẫn tra cứu, không suy ra ngày, giờ hoặc lịch cá nhân.
  const asksSpecificTime = /\b(?:khi nao|luc nao|ngay|thoi gian|may gio|when|what\s+(?:date|time)|which\s+day)\b/.test(q);
  if (!exam || !lookup || asksSpecificTime)
    return null;
  const url = "https://pdaotao.duytan.edu.vn/EXAM_LIST/Default.aspx?lang=VN";
  return {
    status: "answered",
    content: english
      ? `You can check the DTU Academic Affairs exam list here: ${url} [1]\n\nSelect the relevant course or exam list. The page is in Vietnamese; check your course and exam period.`
      : `Bạn có thể xem danh sách thi trên trang Danh Sách Thi của Ban Đào tạo DTU: ${url} [1]\n\nChọn môn hoặc danh sách phù hợp để kiểm tra thông tin.`,
    citations: [
      {
        id: "1",
        chunkId: `web:${url}`,
        documentId: "web",
        revisionId: "web",
        title: "Danh Sách Thi - Ban Đào tạo DTU",
        version: 1,
        page: 1,
        pageEnd: 1,
        section: "Danh Sách Thi",
        quote: "Danh Sách Thi",
        scope:
          "Trang danh sách thi công khai; sinh viên cần đối chiếu môn và kỳ thi. Đường dẫn được đối chiếu ngày 28/10/2026.",
        url,
        retrievedAt: "2026-10-28T00:00:00+07:00",
        sourceTier: "official",
      },
    ],
    retrieval: [],
    reason: "official_exam_directory",
    webStatus: "not_needed",
  };
}

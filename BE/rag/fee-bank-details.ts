// Mục đích file: Gắn tài khoản ngân hàng từ thông báo chính thức đúng phạm vi học kỳ kèm nguồn.
import { normalize } from "./parser";
import type { Answer } from "./answer";

// Số tài khoản được đọc từ thông báo DTU HK1 2026–2027, không khẳng định hiệu lực cho kỳ khác.
export function attachBankDetails(question: string, answer: Answer): Answer {
  // Nhận diện câu hỏi có liên quan học phí và ngân hàng sau khi bỏ dấu tiếng Việt.
  const q = normalize(question);
  const isPayment =
    /\b(?:hoc phi|nop tien|chuyen khoan)\b/.test(q) &&
    /\b(?:ngan hang|vietinbank|viettinbank|vietcombank|chuyen khoan|so tai khoan|stk|noi dung)\b/.test(
      q,
    );
  // Không bổ sung thông tin tài khoản vào câu trả lời lỗi hoặc chưa có nguồn.
  if (!isPayment || answer.status !== "answered" || !answer.citations.length)
    return answer;
  // Thông báo chỉ áp dụng HK1 2026–2027: bỏ qua khi người dùng nêu kỳ khác.
  const years = [...q.matchAll(/\b20\d{2}\b/g)].map((m) => Number(m[0]));
  if (
    years.some((y) => y !== 2026 && y !== 2027) ||
    /\b(?:hk\s*2|hoc ky\s*(?:2|ii|he)|ky he)\b/.test(q)
  )
    return answer;
  const url =
    "https://files01.duytan.edu.vn/svruploads/banctsv-duytan/639200788897171411-47b1538fbb16bacb46459360fa53eb0d.pdf";
  // Cấp số trích dẫn mới, không ghi đè các nguồn đã có trong câu trả lời.
  const id = String(
    Math.max(0, ...answer.citations.map((c) => Number(c.id) || 0)) + 1,
  );
  return {
    ...answer,
    content: `${answer.content}\n\nTheo thông báo DTU cho HK1 năm học 2026–2027: đơn vị thụ hưởng Đại học Duy Tân; VietinBank CN Đà Nẵng: 118000181119; Vietcombank CN Đà Nẵng: 6811111994. [${id}]\nKiểm tra thông báo mới nhất của đúng học kỳ và tên người thụ hưởng trước khi chuyển.`,
    citations: [
      ...answer.citations,
      {
        id,
        chunkId: `web:${url}`,
        documentId: "web",
        revisionId: "web",
        title: "Thông báo nộp học phí HK1 năm học 2026–2027",
        version: 1,
        page: 1,
        pageEnd: 1,
        section: "3.1 Chuyển khoản",
        quote: "Thông báo nộp học phí HK1 2026–2027, mục 3.1, trang 1.",
        scope:
          "Áp dụng theo thông báo HK1 năm học 2026–2027; không tự suy ra kỳ khác.",
        url,
        sourceTier: "official",
      },
    ],
  };
}

// Mục đích file: Kiểm thử: Số tài khoản gắn đúng nguồn, phạm vi học kỳ và không xuất hiện khi thiếu căn cứ.
import test from "node:test";
import assert from "node:assert/strict";
import { attachBankDetails } from "../../BE/rag/fee-bank-details";
// Tạo câu trả lời có một nguồn giả lập để kiểm tra việc thêm nguồn ngân hàng thứ hai.
const answer = {
  status: "answered",
  content: "Có nguồn",
  citations: [
    {
      id: "1",
      chunkId: "c",
      documentId: "d",
      revisionId: "r",
      title: "Nguồn",
      version: 1,
      page: 1,
      pageEnd: 1,
      section: "",
      quote: "",
      scope: "",
    },
  ],
  retrieval: [],
  reason: "test",
  webStatus: "not_needed",
};
test("thông tin tài khoản được gắn nguồn và phạm vi đúng kỳ", () => {
  // Câu hỏi chuyển khoản phải có số tài khoản, phạm vi học kỳ và nguồn DTU riêng.
  const result = attachBankDetails("chuyển khoản học phí VietinBank", answer);
  assert.match(result.content, /118000181119/);
  assert.match(result.content, /HK1 năm học 2026–2027/);
  assert.equal(result.citations[1].id, "2");
  assert.match(result.citations[1].url!, /duytan\.edu\.vn/);
  // Câu hỏi thuộc kỳ khác hoặc chỉ hỏi mức học phí không được gắn số tài khoản kỳ này.
  assert.equal(
    attachBankDetails("chuyển khoản học phí HK2 2025-2026", answer),
    answer,
  );
  assert.equal(
    attachBankDetails("học phí ngành công nghệ bao nhiêu", answer),
    answer,
  );
  // Nếu câu trả lời chưa có nguồn thì không thêm số tài khoản vào phản hồi.
  assert.equal(
    attachBankDetails("chuyển khoản học phí", {
      ...answer,
      status: "insufficient",
      citations: [],
    }).citations.length,
    0,
  );
});

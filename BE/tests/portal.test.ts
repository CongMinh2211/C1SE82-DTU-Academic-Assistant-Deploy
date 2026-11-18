// Mục đích file: Kiểm thử: Định tuyến câu hỏi cổng thông tin và phân biệt cách nộp với mức học phí.
import test from "node:test";
import assert from "node:assert/strict";
import { portalAnswer } from "../../BE/rag/portal";
// Câu hỏi chung về nộp học phí phải dẫn tới portal và thông báo có kỳ áp dụng.
test("hướng dẫn nộp học phí dẫn tới portal và thông báo theo kỳ", () => {
  const answer = portalAnswer("nộp học phí sao");
  assert.equal(answer?.citations.length, 2);
  assert.match(answer!.content, /mydtu\.duytan\.edu\.vn/);
  assert.match(answer!.content, /2026–2027/);
});
// Câu hỏi mức tiền không bị chuyển thành hướng dẫn thao tác nộp.
test("không đánh tráo câu hỏi số tiền với cách nộp", () => {
  assert.equal(portalAnswer("nộp học phí bao nhiêu"), null);
  assert.ok(portalAnswer("xem bảng điểm ở đâu"));
});
// Hai câu hỏi chi tiết này không được chặn bởi câu trả lời portal chung.
test("câu hỏi nội dung chuyển khoản và VietinBank đi qua tra cứu tài liệu", () => {
  assert.equal(portalAnswer("điền nội dung nộp học phí sao"), null);
  assert.equal(portalAnswer("nộp học phí bằng viettinbank thì sao"), null);
});

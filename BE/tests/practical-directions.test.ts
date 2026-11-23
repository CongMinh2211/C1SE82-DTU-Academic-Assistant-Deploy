import test from "node:test";
import assert from "node:assert/strict";
import { practicalDirections } from "../rag/practical-directions";
import { answerLanguageForQuestion, protectLocations } from "../rag/translate-answer";

test("thư viện trả lời địa điểm có nguồn và lưu ý ngày cập nhật", () => {
  const result = practicalDirections("thư viện trường ở đâu?");
  assert.match(result!.content, /254 Nguyễn Văn Linh/);
  assert.match(result!.content, /xác nhận/);
  assert.equal(result!.citations[0].url, "https://sbe.duytan.edu.vn/library-services/19");
  assert.equal(practicalDirections("thư viện có những sách nào"), null);
});
test("giữ nguyên địa danh khi dịch và từ chối bản dịch bị mất địa danh", () => {
  const locations = protectLocations("254 Nguyễn Văn Linh, Đà Nẵng");
  assert.equal(locations.restore(locations.protectedText), "254 Nguyễn Văn Linh, Đà Nẵng");
  assert.throws(() => locations.restore("254"));
});
test("mẫu bảo lưu có giới hạn phạm vi của khoa", () => {
  const result = practicalDirections("làm đơn bảo lưu ở đâu?");
  assert.match(result!.content, /Khoa Tiếng Trung/);
  assert.match(result!.content, /không xác nhận nơi nộp chung/);
  assert.match(result!.citations[0].url!, /duytan\.edu\.vn/);
});
test("tự động nhận ngôn ngữ câu hỏi; lựa chọn riêng được ưu tiên", () => {
  assert.equal(answerLanguageForQuestion("auto", "टीचर सान्ह का फ़ोन नंबर"), "hi");
  assert.equal(answerLanguageForQuestion("auto", "Where is the library?"), "en");
  assert.equal(answerLanguageForQuestion("auto", "thư viện ở đâu"), "vi");
  assert.equal(answerLanguageForQuestion("hi", "thư viện ở đâu"), "hi");
});

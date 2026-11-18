import { test } from "node:test";
import { strict as assert } from "node:assert";
import { studentPageText } from "../lib/student-page-text";

// Ba trang cần có nhãn riêng cho cả tiếng Anh và tiếng Hindi; tiếng Việt giữ nguyên.
test("dịch nhãn chính và thao tác của ba trang sinh viên", () => {
  for (const label of ["Lịch sử hỏi đáp", "Gửi góp ý", "Thông tin tài khoản", "Xóa vĩnh viễn", "Lưu hồ sơ", "Hủy"]) {
    assert.equal(studentPageText("vi", label), label);
    assert.notEqual(studentPageText("en", label), label);
    assert.notEqual(studentPageText("hi", label), label);
  }
});

// Nội dung người dùng không nằm trong từ điển không bị tự ý dịch hoặc thay đổi.
test("giữ nguyên dữ liệu không thuộc nhãn giao diện", () => {
  assert.equal(studentPageText("en", "Tên hội thoại của sinh viên"), "Tên hội thoại của sinh viên");
});

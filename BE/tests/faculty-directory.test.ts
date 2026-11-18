import { test } from "node:test";
import assert from "node:assert/strict";
import { facultyDirectoryAnswer } from "../rag/faculty-directory";

test("liên hệ khoa trả phòng, máy lẻ và nguồn chính thức", () => {
  const answer = facultyDirectoryAnswer("Văn phòng khoa Dược ở đâu?");
  assert.equal(answer?.status, "answered");
  assert.match(answer!.content, /201.*120 Hoàng Minh Thảo/);
  assert.match(answer!.content, /máy lẻ 302/);
  assert.equal(answer!.citations[0].url, "https://cmp.duytan.edu.vn/khoa-duoc-1ea/gioi-thieu-khoa-duoc-x2s");
});
test("không chặn câu hỏi không phải liên hệ hoặc tự gán ngành cho khoa", () => {
  assert.equal(facultyDirectoryAnswer("Khoa Dược học những môn nào?"), null);
  assert.equal(facultyDirectoryAnswer("Ngành Digital Marketing thuộc khoa nào?"), null);
  assert.equal(facultyDirectoryAnswer("Email thầy Nguyễn Văn A khoa Dược là gì?"), null);
});
test("khoa đào tạo quốc tế có hai liên kết bản đồ tách riêng", () => {
  const answer = facultyDirectoryAnswer("Văn phòng khoa Đào tạo Quốc tế ở đâu?");
  const urls = answer!.content.match(/https:\/\/www\.google\.com\/maps\/search\/\?[^\s]+/g) || [];
  assert.equal(urls.length, 2);
  assert.match(decodeURIComponent(urls[0]), /254 Nguyễn Văn Linh/);
  assert.match(decodeURIComponent(urls[1]), /120 Hoàng Minh Thảo/);
});

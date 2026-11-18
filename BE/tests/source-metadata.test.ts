// Mục đích file: Kiểm thử: Xác thực thông tin và liên kết gốc khi thêm tài liệu.
import test from "node:test";
import assert from "node:assert/strict";
import { uploadSourceUrl } from "../../BE/source-metadata";

// Kiểm tra chỉ nhận liên kết nguồn phù hợp quy tắc HTTPS và miền DTU.
test("liên kết gốc tùy chọn khi tải file chỉ nhận HTTPS của DTU", () => {
  assert.equal(uploadSourceUrl(""), undefined);
  assert.equal(
    uploadSourceUrl("https://is.duytan.edu.vn/international-school?page=1"),
    "https://is.duytan.edu.vn/international-school?page=1",
  );
  assert.equal(
    uploadSourceUrl("https://files01.duytan.edu.vn/capstone.pdf#page=3"),
    "https://files01.duytan.edu.vn/capstone.pdf#page=3",
  );
  for (const invalid of [
    "http://duytan.edu.vn",
    "https://duytan.edu.vn.example.com",
    "https://127.0.0.1/",
  ])
    assert.throws(() => uploadSourceUrl(invalid));
});

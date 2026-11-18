// Mục đích file: Kiểm thử: Ánh xạ các câu hỏi myDTU tới đúng trang hướng dẫn đã đối chiếu.
import test from "node:test";
import assert from "node:assert/strict";
import { guidePage } from "../../BE/rag/mydtu-guide";
test("đưa các mục myDTU tới trang PDF đã đối chiếu", () => {
  // Đối chiếu các chức năng học tập và học phí với số trang trong PDF gốc.
  assert.equal(guidePage("xem lịch học trên myDTU")?.page, 16);
  assert.equal(guidePage("đăng ký môn trong myDTU")?.page, 24);
  assert.equal(guidePage("xem bảng điểm myDTU")?.page, 31);
  assert.equal(guidePage("lịch sử thanh toán trên myDTU")?.page, 45);
  // Lịch thi có đường tra cứu riêng, không được ánh xạ nhầm vào hướng dẫn myDTU.
  assert.equal(guidePage("lịch thi ở đâu"), null);
  // Ba mục trong ảnh minh họa phải dẫn tới đúng trang đã xem.
  assert.equal(guidePage("khai báo ngoại trú")?.page, 41);
  assert.equal(guidePage("cách đánh giá giảng viên")?.page, 42);
  assert.equal(guidePage("đánh giá rèn luyện sao")?.page, 40);
  // Câu hỏi hạn chót không được trả lời bằng trang hướng dẫn thao tác cũ.
  assert.equal(guidePage("hạn chót khai báo ngoại trú năm nay"), null);
});

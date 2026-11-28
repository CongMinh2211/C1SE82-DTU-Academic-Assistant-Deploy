// Mục đích file: Kiểm thử: Phân biệt yêu cầu hỗ trợ học tập với yêu cầu cần truy xuất nguồn.
import test from "node:test";
import assert from "node:assert/strict";
import { obviousStudyTask } from "../../BE/rag/dialogue";
// Yêu cầu học tập hoặc dữ liệu cá nhân không bị chuyển nhầm thành tra cứu quy định.
test("clear learning and user-data tasks cannot fall into institutional retrieval", () => {
  for (const q of [
    "Tính trung bình hệ 10: A 8 điểm 3 tín chỉ, B 6 điểm 2 tín chỉ. Không quy đổi hệ 4.",
    "Giúp em lập lịch ôn thi 7 ngày, mỗi ngày 2 giờ.",
    "I have 3 days to revise sorting algorithms. Give me a practical plan.",
    "Soạn email hỏi cách đăng ký học cải thiện, để trống người nhận.",
  ])
    assert.equal(obviousStudyTask(q, []), true, q);
  for (const q of [
    "Tính tổng học phí K31 mã 102 cho 20 tín chỉ",
    "Điều kiện đăng ký học phần theo quy định DTU là gì?",
    "Calculate average grades under the official DTU policy and convert to GPA.",
    "Theo quy định, giúp em xem hạn đăng ký tốt nghiệp ngày nào?",
  ])
    assert.equal(obviousStudyTask(q, []), false, q);
  assert.equal(
    obviousStudyTask("Rút lại còn 3 ngày, 60 phút mỗi ngày", [
      { role: "user", content: "Lập lịch ôn thi 7 ngày" },
    ]),
    true,
  );
});


test("code HTML là yêu cầu học tập mới, không nối sang biểu mẫu học phần", () => {
  assert.equal(obviousStudyTask("code html", [{role:"user",content:"mẫu đăng ký học phần"}]), true);
  assert.equal(obviousStudyTask("viết code html mẫu đăng ký học phần", []), true);
});

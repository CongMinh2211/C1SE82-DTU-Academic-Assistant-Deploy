// Mục đích file: Kiểm thử: Giữ đúng dữ kiện đã biết khi soạn email và không dùng lại chủ đề cũ.
import test from "node:test";
import assert from "node:assert/strict";
import {
  fillKnownEmailContext,
  knownEmailCase,
} from "../../BE/rag/email-context";
const history = [
  {
    role: "user" as const,
    content:
      "K31 mã 102, năm học 2026-2027, đóng học phí trễ 45 ngày bị phạt bao nhiêu?",
  },
];
// Điền các dữ kiện đã biết vào thư, giữ trống thông tin người nhận và mã cá nhân chưa biết.
test("an email draft fills known case fields while leaving recipient and personal IDs unknown", () => {
  const q =
    "Soạn email hỏi mức phạt cho trường hợp vừa rồi, để trống thông tin chưa biết.";
  const draft =
    "Chủ đề: Hỏi về mức phạt\n\nKính gửi [Người nhận],\n\nEm thuộc khóa [Khóa], MSSV [MSSV], năm học [Năm học], đóng học phí trễ [số ngày] ngày.\n\nEm cảm ơn.";
  const result = fillKnownEmailContext(draft, q, history);
  for (const value of [
    "K31",
    "102",
    "2026-2027",
    "45",
    "[Người nhận]",
    "[MSSV]",
  ])
    assert.ok(result.includes(value), value);
  assert.deepEqual(knownEmailCase(q, history), {
    cohort: "K31",
    programmeCode: "102",
    academicYear: "2026-2027",
    tuitionLateDays: 45,
  });
});
// Yêu cầu email mới không được mang thông tin học phí của chủ đề trước.
test("a new email topic does not inherit an unrelated prior tuition case", () => {
  const q = "Soạn email xin phép vắng một buổi học vì việc gia đình.";
  const draft = "Kính gửi [Thầy/Cô],\nEm thuộc khóa [Khóa], MSSV [MSSV].";
  assert.equal(fillKnownEmailContext(draft, q, history), draft);
});
// Hỏi tiếp về chủ đề học tập gần nhất không được khôi phục ngữ cảnh học phí cũ.
test("a reference to the latest study topic does not resurrect an older tuition case", () => {
  const q = "Soạn email cho giảng viên về kế hoạch vừa rồi.";
  assert.deepEqual(
    knownEmailCase(q, [
      ...history,
      { role: "user", content: "Giúp em lập kế hoạch ôn thi trong 3 ngày." },
    ]),
    {},
  );
});
// Khi yêu cầu mẫu thư trống, không chèn lại dữ kiện cá nhân từng cung cấp.
test("an explicitly anonymous blank template does not get case details reinserted", () => {
  const q = "Soạn email ẩn danh, để trống tất cả chi tiết trường hợp vừa rồi.";
  const draft = "Kính gửi [Người nhận],\nEm thuộc khóa [Khóa].";
  assert.equal(fillKnownEmailContext(draft, q, history), draft);
});

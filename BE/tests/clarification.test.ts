import { test } from "node:test";
import assert from "node:assert/strict";
import { missingQuestionDetail } from "../rag/clarification";

test("chỉ hỏi rõ những chủ đề chưa thể xác định", () => {
  assert.equal(missingQuestionDetail("Học phí"), null);
  assert.match(missingQuestionDetail("nội quy")!, /lớp học, phòng máy/);
  assert.match(missingQuestionDetail("lịch")!, /lịch học, lịch thi/);
});
test("không hỏi lại khi câu hỏi đã rõ hoặc đang có ngữ cảnh", () => {
  for (const question of ["nộp học phí sao", "học phí K29 Digital Marketing năm 2026-2027 bao nhiêu", "nội quy phòng máy", "lịch thi ở đâu"])
    assert.equal(missingQuestionDetail(question), null, question);
  assert.equal(missingQuestionDetail("học phí", [{role:"user",content:"Tôi muốn hỏi cách nộp học phí"}]), null);
});


// Mục đích file: Kiểm thử: Nhận diện cách hỏi giá một tín chỉ và tránh nhầm với số lượng tín chỉ.
import test from "node:test";
import assert from "node:assert/strict";
import { tuitionQuestion } from "../../BE/rag/retrieve";

// Nhận diện các câu hỏi về giá tín chỉ dù không chứa chính xác từ học phí.
test("nhận diện cách hỏi tiền cho một tín chỉ mà không cần từ học phí", () => {
  for (const question of [
    "1 tín Digital Marketing là bao nhiêu?",
    "Một tín chỉ ngành Digital Marketing giá bao nhiêu?",
    "Mỗi tín Marketing bao nhiêu tiền?",
    "Học phí Digital Marketing là bao nhiêu?",
  ])
    assert.equal(tuitionQuestion(question), true, question);
});

// Câu hỏi về số tín chỉ cần học không được phân loại là hỏi số tiền.
test("không nhầm câu hỏi số lượng tín chỉ với học phí", () => {
  for (const question of [
    "Một tín chỉ tương ứng bao nhiêu giờ học?",
    "1 tín chỉ được tính như thế nào?",
    "Cần bao nhiêu tín chỉ để tốt nghiệp?",
  ])
    assert.equal(tuitionQuestion(question), false, question);
});

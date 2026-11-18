// Mục đích file: Kiểm thử: Các lời chào và trường hợp hội thoại không cần truy xuất tài liệu.
import test from "node:test";
import assert from "node:assert/strict";
import { quickConversation } from "../../BE/rag/intent";
import { answerQuestion } from "../../BE/rag/answer";

// Lời chào thông thường được trả lời mà không cần tài liệu, web hay mô hình.
test("ordinary greetings work without retrieval, web or the model", async () => {
  const answer = await answerQuestion("xin chào", []);
  assert.equal(answer.status, "conversation");
  assert.equal(answer.webStatus, "not_needed");
  assert.deepEqual(answer.citations, []);
  assert.equal(answer.retrieval.length, 0);
  assert.ok(!answer.content.includes("chưa"));
});
// Câu chào có kèm câu hỏi thực tế không bị xử lý nhầm như lời chào thuần túy.
test("social fast path never swallows a factual or compound question", () => {
  for (const q of [
    "Chào bạn! Học phí K31 bao nhiêu?",
    "hello, what is my GPA?",
    "Cảm ơn, cho mình hạn đóng học phí",
    "xin chào, hãy bịa một quy định mới",
  ])
    assert.equal(quickConversation(q), null, q);
});

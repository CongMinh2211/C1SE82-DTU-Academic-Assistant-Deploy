import test from "node:test";
import assert from "node:assert/strict";
import { alreadyInLanguage, preservesReferences, translateAnswer } from "../rag/translate-answer";
test("bản dịch phải giữ nguyên số, nguồn và đường dẫn", () => {
  const a="Học phí 2.000 đồng [1] https://example.edu.vn/";
  assert.equal(preservesReferences(a,"Fee 2.000 VND [1] https://example.edu.vn/"),true);
  assert.equal(preservesReferences(a,"Fee 3.000 VND [1] https://example.edu.vn/"),false);
  assert.equal(preservesReferences(a,"Fee 2.000 VND https://example.edu.vn/"),false);
});
test("chế độ tự động không gọi AI và giữ nguyên câu trả lời", async () => {
  assert.deepEqual(await translateAnswer("Nội dung [1]", "auto"),{text:"Nội dung [1]",translated:false});
});

// Không gọi dịch lại khi câu đã đúng ngôn ngữ; nội dung mơ hồ vẫn phải qua kiểm tra dịch.
test("nhận diện câu trả lời đã đúng ngôn ngữ một cách thận trọng", async () => {
  assert.equal(alreadyInLanguage("Bạn có thể xem học phí của bạn tại trường [1].", "vi"), true);
  assert.equal(alreadyInLanguage("You can view the tuition information [1].", "en"), true);
  assert.equal(alreadyInLanguage("आप अपनी जानकारी यहाँ देख सकते हैं।", "hi"), true);
  assert.equal(alreadyInLanguage("K29 CMU 2026 [1]", "vi"), false);
  assert.deepEqual(await translateAnswer("You can view the tuition information [1].", "en"), {text:"You can view the tuition information [1].", translated:false});
});

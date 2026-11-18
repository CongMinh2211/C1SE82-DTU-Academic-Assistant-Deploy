import { test } from "node:test";
import assert from "node:assert/strict";
import { composeVoiceTranscript } from "../lib/voice-transcript";

test("hiển thị cả kết quả tạm và kết quả chính thức mà không nối trùng", () => {
  const interim = [{ 0: { transcript: "học phí" }, isFinal: false }];
  const final = [{ 0: { transcript: "học phí K29" }, isFinal: true }];
  assert.equal(composeVoiceTranscript("Cho mình hỏi", interim), "Cho mình hỏi học phí");
  assert.equal(composeVoiceTranscript("Cho mình hỏi", final), "Cho mình hỏi học phí K29");
  assert.equal(composeVoiceTranscript("", [{0:{transcript:"đăng ký"}},{0:{transcript:"học phần"}}]), "đăng ký học phần");
  assert.equal(composeVoiceTranscript("abc", [{0:{transcript:"12345"}}], 6), "abc 12");
});

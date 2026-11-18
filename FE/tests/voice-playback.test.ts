import test from "node:test";
import assert from "node:assert/strict";
import { shouldAutoPlay, speechLanguage, speechText } from "../lib/voice-playback";

test("văn bản đọc bỏ URL dài và số trích dẫn nhưng không sửa bản gốc", () => {
  const original = "Xem học phí [1] tại https://mydtu.duytan.edu.vn/";
  assert.equal(speechText(original), "Xem học phí tại đường dẫn");
  assert.match(original, /\[1\]/);
});
test("chọn ngôn ngữ đọc theo nội dung và tùy chọn dự phòng", () => {
  assert.equal(speechLanguage("Học phí bao nhiêu?", "en"), "vi-VN");
  assert.equal(speechLanguage("Where is my class?", "en"), "en-US");
  assert.equal(speechLanguage("नमस्ते", "vi"), "hi-IN");
});

test("chỉ đọc lượt voice mới đã hoàn tất, không phát lại lịch sử", () => {
  assert.equal(shouldAutoPlay(true,false,"new","new","answered"),true);
  assert.equal(shouldAutoPlay(true,false,"new","old","answered"),false);
  assert.equal(shouldAutoPlay(true,true,"new","new","answered"),false);
  assert.equal(shouldAutoPlay(true,false,"new","new","processing"),false);
  assert.equal(shouldAutoPlay(false,false,"new","new","answered"),false);
});

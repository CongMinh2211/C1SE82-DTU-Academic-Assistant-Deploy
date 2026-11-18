import test from "node:test";
import assert from "node:assert/strict";
import { languageKey, parseLanguage, answerLanguageKey, parseAnswerLanguage } from "../lib/language";
test("ngôn ngữ lưu riêng theo từng tài khoản và dữ liệu lạ trở về mặc định", () => {
  assert.notEqual(languageKey("a"), languageKey("b")); assert.notEqual(answerLanguageKey("a"),answerLanguageKey("b"));
  assert.equal(parseLanguage("hi"),"hi"); assert.equal(parseLanguage("x"),"vi"); assert.equal(parseAnswerLanguage("en"),"en"); assert.equal(parseAnswerLanguage("x"),"auto");
});

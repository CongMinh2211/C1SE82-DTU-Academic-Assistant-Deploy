import test from "node:test";
import assert from "node:assert/strict";
import { faqMatches } from "../lib/faq-search";

test("FAQ matches decomposed Vietnamese and uppercase D with stroke", () => {
  const label = "ĐĂNG KÝ HỌC".normalize("NFD");
  assert.equal(faqMatches("hoc dang", label), true);
});

test("A nonempty FAQ search needs a match when fields are absent", () => {
  assert.equal(faqMatches("tuition", null, undefined, ""), false);
  assert.equal(faqMatches("tuition", null, "Tuition payment", undefined), true);
});

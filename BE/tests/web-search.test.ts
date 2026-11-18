// Mục đích file: Kiểm thử: Phân loại nhà xuất bản, lọc địa chỉ không an toàn và chọn kết quả web phù hợp.
import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceAssessment,
  relevantToUniversity,
  selectedPassages,
  canonicalSearchUrl,
} from "../../BE/web-sources";
import {
  scopedSearchQuery,
  chooseSearchCandidates,
  selectWebSources,
} from "../../BE/web-search";
import type { WebEvidence } from "../../BE/official-web";
import { draftSchema, validateDraft } from "../../BE/rag/answer";
import type { Evidence } from "../../BE/rag/retrieve";

// Miền trông giống DTU nhưng không thuộc DTU không được phân loại là nguồn chính thức.
test("publisher classification resists lookalike domains", () => {
  assert.equal(
    sourceAssessment("https://news.duytan.edu.vn/x").tier,
    "official",
  );
  assert.equal(
    sourceAssessment("https://www.timeshighereducation.com/x").tier,
    "institutional",
  );
  assert.equal(sourceAssessment("https://tuoitre.vn/x").tier, "press");
  assert.notEqual(
    sourceAssessment("https://evilduytan.edu.vn").tier,
    "official",
  );
  for (const url of [
    "https://duytan.edu.vn.evil.example",
    "https://vnexpress.net.evil.example",
  ])
    assert.equal(sourceAssessment(url).tier, "other");
});
// Tìm kiếm toàn web vẫn ưu tiên nội dung liên quan tới trường.
test("global search keeps university relevance without restricting domains", () => {
  assert.doesNotMatch(
    scopedSearchQuery("site:duytan.edu.vn xếp hạng"),
    /site:/,
  );
  assert.match(scopedSearchQuery("xếp hạng"), /Đại học Duy Tân/);
  assert.equal(
    relevantToUniversity(
      "Đường Duy Tân",
      "Giá nhà tại đường Duy Tân",
      "https://example.com",
    ),
    false,
  );
  assert.equal(
    relevantToUniversity(
      "Ranking",
      "Duy Tan University",
      "https://edurank.org/x",
    ),
    true,
  );
});
// Loại liên kết trùng do tham số theo dõi và giữ vị trí cho nguồn ngoài phù hợp.
test("selection deduplicates tracking URLs and reserves external publishers", () => {
  const input = [
    "https://duytan.edu.vn/a",
    "https://duytan.edu.vn/b",
    "https://duytan.edu.vn/a?utm_source=x",
    "https://edurank.org/x",
    "https://www.timeshighereducation.com/x",
    "https://tuoitre.vn/x",
    "https://127.0.0.1/private",
  ].map((url, i) => ({ url, title: "", snippet: "", score: 24 - i }));
  const chosen = chooseSearchCandidates(input);
  assert.equal(chosen.length, 5);
  assert.equal(
    chosen.filter((c) => sourceAssessment(c.url).tier !== "official").length,
    3,
  );
  assert.equal(chosen.filter((c) => c.url.includes("127.0.0.1")).length, 0);
  assert.equal(
    canonicalSearchUrl("https://example.com/a?year=2026&utm_source=x#y"),
    "https://example.com/a?year=2026",
  );
});
// Đoạn ngắn chứa số liệu phải giữ liên hệ với tiêu đề xếp hạng.
test("short numerical paragraphs remain attached to ranking headings", () => {
  const excerpt = selectedPassages(
    "Duy Tan University\n\nRankings\n\nWorld University Rankings 2026\n\n501–600\n\nImpact Rankings\n\n701–800",
    "World University Rankings 2026",
  );
  assert.match(excerpt, /2026\n\n501–600/);
});
// Một nguồn chưa phân loại không đủ để tự xác lập câu trả lời có căn cứ.
test("unclassified publisher cannot alone establish an answer", () => {
  const evidence = [
    { id: "W1", documentId: "web", sourceTier: "other" },
  ] as Evidence[];
  const draft = draftSchema.parse({
    status: "answered",
    claims: [{ text: "Fact", evidence: [{ sourceId: "W1" }] }],
    followUp: "",
  });
  assert.equal(validateDraft(draft, evidence), false);
  evidence[0].sourceTier = "institutional";
  assert.equal(validateDraft(draft, evidence), true);
});
// Gộp kết quả tìm kiếm vẫn giữ nguồn chương trình cụ thể dù đến sau.
test("merging search providers keeps the specific programme source even when it arrives last", () => {
  const sources = [
    "Thông báo học phí 2026",
    "Thông báo xét giảm học phí",
    "Học IT tại ĐH Duy Tân",
    "Chương trình Sinh viên Ưu tú",
  ].map((title, i) => ({
    title,
    url: `https://duytan.edu.vn/${i}`,
    text: `Đại học Duy Tân. ${title}. Thông tin nguồn ${i}`,
    official: true,
    retrievedAt: "2026-10-24",
  })) satisfies WebEvidence[];
  const selected = selectWebSources(
    sources,
    "Chương trình Sinh viên Ưu tú có chính sách học phí như thế nào?",
  );
  assert.equal(selected.length, 3);
  assert.equal(selected[0].title, "Chương trình Sinh viên Ưu tú");
});
// Trang dài vẫn phải giữ tên chính xác và các giá trị lân cận.
test("long pages keep a precise short-word name and neighbouring source values", () => {
  const noise = Array.from(
    { length: 30 },
    (_, i) =>
      `Thông báo học phí ${i}. ` + "Nội dung thông báo khác. ".repeat(35),
  );
  const text = [
    ...noise.slice(0, 15),
    "Chương trình Sinh viên Ưu tú",
    "65 suất học bổng toàn phần",
    ...noise.slice(15),
  ].join("\n\n");
  assert.ok(text.length > 14000);
  const selected = selectedPassages(
    text,
    "chương trình Sinh viên Ưu tú có chính sách học phí gì?",
  );
  assert.match(selected, /Sinh viên Ưu tú\n\n65 suất/);
  assert.ok(selected.length <= 14000);
});

// Mục đích file: Kiểm thử: Giữ đúng dữ liệu từng dòng học phí, khóa, mã và đơn vị.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseConsolidated, chunkPages } from "../../BE/rag/parser";
import {
  tuitionTableAnswer,
  tuitionLookupSpec,
} from "../../BE/rag/tuition";
import type { Evidence } from "../../BE/rag/retrieve";
const sources = parseConsolidated(
  await readFile("knowledge/originals/Tailieu_AI_Tong_hop.txt", "utf8"),
);
const corpus: Evidence[] = [];
for (const source of sources.slice(3))
  for (const chunk of await chunkPages(
    source.pages,
    source.title,
    source.scope,
    source.sourceId,
  ))
    if (/^\d+\s*\|/m.test(chunk.text))
      corpus.push({
        id: chunk.id,
        chunkId: chunk.id,
        documentId: source.sourceId,
        revisionId: source.sourceId,
        title: source.title,
        version: 1,
        page: chunk.page,
        pageEnd: chunk.pageEnd,
        section: chunk.section,
        text: chunk.text,
        scope: source.scope,
        score: 1,
      });
// Đối chiếu từng dòng học phí với giá trị, đơn vị và nguồn gốc.
test("all 499 original tuition rows report exact source values, units and references", () => {
  assert.equal(corpus.length, 499);
  for (const evidence of corpus) {
    const line = evidence.text.split("\n").find((l) => /^\d+\s*\|/.test(l))!;
    const cells = line.split("|").map((c) => c.trim());
    const cohort = evidence.title.match(/K\d+/)![0];
    const a = tuitionTableAnswer(
      `Học phí ${cohort} mã ${cells[2]} năm học 2026-2027 bao nhiêu?`,
      [evidence],
    );
    assert.ok(a, `${evidence.documentId}: ${cells[2]}`);
    assert.equal(a.status, "answered");
    const actual = a.content.replace(/[.,\s]/g, "");
    const semesterLine = a.content
      .split("\n")
      .find((l) => l.startsWith("• Học phí học kỳ:"))!;
    const creditLine = a.content
      .split("\n")
      .find((l) => l.startsWith("• Đơn giá tín chỉ:"))!;
    for (const [line, amount] of [
      [semesterLine, cells[4]],
      [creditLine, cells[3]],
    ]) {
      if (amount)
        assert.ok(
          line.replace(/[.,\s]/g, "").includes(amount.replace(/[.,\s]/g, "")),
          `${cohort} ${cells[2]} must keep the correct fee column`,
        );
      else assert.ok(line.includes("chưa ghi trong bảng gốc"));
    }
    for (const amount of [cells[3], cells[4]].filter(Boolean))
      assert.ok(
        actual.includes(amount.replace(/[.,\s]/g, "")),
        `${cohort} ${cells[2]} ${amount}`,
      );
    assert.equal(a.citations.length, 1);
    assert.equal(a.citations[0].quote, evidence.text);
    assert.equal(a.citations[0].page, evidence.page);
    assert.equal(a.citations[0].documentId, evidence.documentId);
  }
});
// Không dùng đường trả lời bảng cho câu hỏi phạt, tính toán, kiểm tra mới nhất hoặc nhiều chủ đề.
test("penalties, calculations, current web verification and mixed topics never use the table shortcut", () => {
  for (const q of [
    "K31 mã 102 năm 2026-2027 học phí trễ 45 ngày phạt bao nhiêu?",
    "Học phí K31 mã 102 năm 2026-2027 và điều kiện tốt nghiệp?",
    "Tìm web học phí K31 mã 102 năm 2026-2027",
    "Tính tổng học phí K31 mã 102 năm 2026-2027 cho 150 tín chỉ",
    "Học phí mới nhất K31 mã 102 năm 2026-2027 bao nhiêu?",
    "Soạn email hỏi học phí K31 mã 102 năm 2026-2027",
    "Theo Times Higher Education, học phí K31 mã 102 năm 2026-2027 bao nhiêu?",
  ])
    assert.equal(tuitionLookupSpec(q), null, q);
});
// Không đổi nhầm khóa, năm hoặc hậu tố mã ngành; từ chối khi các dòng mâu thuẫn.
test("exact code suffixes, cohort and year cannot be swapped; conflicting rows abstain", () => {
  const a = tuitionTableAnswer(
    "So sánh học phí K27 và K31 mã 102 năm 2026-2027",
    corpus,
  )!;
  assert.ok(a);
  assert.equal(a.citations.length, 2);
  assert.ok(a.content.replace(/[.,\s]/g, "").includes("11520000"));
  assert.ok(a.content.replace(/[.,\s]/g, "").includes("18160000"));
  const cmu = tuitionTableAnswer(
    "Học phí K31 mã 102(CMU) năm 2026-2027 bao nhiêu?",
    corpus,
  )!;
  assert.ok(cmu);
  assert.ok(cmu.content.replace(/[.,\s]/g, "").includes("20320000"));
  assert.ok(!cmu.content.replace(/[.,\s]/g, "").includes("18160000"));
  assert.equal(
    tuitionTableAnswer("Học phí K31 mã 102 năm 2028-2029 bao nhiêu?", corpus),
    null,
  );
  const row = corpus.find(
    (c) => c.documentId === "TL08" && /\| 102 \|/.test(c.text),
  )!;
  assert.equal(
    tuitionTableAnswer("Học phí K31 mã 102 năm 2026-2027 bao nhiêu?", [
      { ...row, scope: "K31 năm 2026-2027, đơn vị USD" },
    ]),
    null,
  );
  assert.equal(
    tuitionTableAnswer("Học phí K31 mã 102 năm 2026-2027 bao nhiêu?", [
      row,
      {
        ...row,
        chunkId: "conflict",
        text: row.text.replace("18,160,000", "99,000,000"),
      },
    ]),
    null,
  );
});

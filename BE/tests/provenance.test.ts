// Mục đích file: Kiểm thử: Bảo toàn thông tin nguồn và số trang khi trích dữ liệu.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseConsolidated, chunkPages } from "../../BE/rag/parser";

const text = await readFile(
  process.env.RAG_SOURCE_PATH || "knowledge/originals/Tailieu_AI_Tong_hop.txt",
  "utf8",
);
const sources = parseConsolidated(text);
// Nhập dữ liệu gốc phải giữ đúng tám nguồn và 61 trang theo thứ tự.
test("canonical import retains all 8 sources and 61 pages, in order", () => {
  assert.deepEqual(
    sources.map((s) => [s.sourceId, s.pages.length]),
    [
      ["TL01", 24],
      ["TL02", 7],
      ["TL03", 4],
      ["TL04", 4],
      ["TL05", 5],
      ["TL06", 5],
      ["TL07", 6],
      ["TL08", 6],
    ],
  );
  for (const source of sources)
    for (const page of source.pages)
      assert.ok(
        text.includes(page.text),
        `${source.sourceId} page ${page.page} changed`,
      );
});
// Dữ liệu thiếu hoặc trùng trang phải báo lỗi thay vì âm thầm đưa vào chỉ mục.
test("missing/repeated source pages fail ingestion instead of silently indexing incomplete data", () => {
  assert.throws(
    () =>
      parseConsolidated(
        text.replace("[TL01 | TRANG PDF 2/24]", "[TL01 | TRANG PDF 1/24]"),
      ),
    /thiếu hoặc sai trang/,
  );
  assert.throws(
    () =>
      parseConsolidated(text.replace("[TL08 | TRANG PDF 6/6]", "[REMOVED]")),
    /thiếu hoặc sai trang/,
  );
});
// Các dòng học phí phải giữ nguyên nhãn và nguồn, không gộp nhầm giữa các ngành.
test("all 499 tuition table rows remain atomic, labeled, and correctly attributed", async () => {
  let count = 0;
  for (const source of sources.slice(3)) {
    const chunks = await chunkPages(
      source.pages,
      source.title,
      source.scope,
      source.sourceId,
    );
    const rows = source.pages.flatMap((p) =>
      p.text
        .split("\n")
        .filter((l) => /^\d+\s*\|/.test(l))
        .map((line) => ({ line, page: p.page })),
    );
    count += rows.length;
    for (const row of rows) {
      const matches = chunks.filter((c) => c.text.includes(row.line));
      assert.equal(matches.length, 1, `${source.sourceId}: ${row.line}`);
      assert.equal(matches[0].page, row.page);
      assert.ok(
        matches[0].text.startsWith(
          "STT | Chuyên ngành | Mã chuyên ngành | Đơn giá tín chỉ | Mức học phí/học kỳ | Ghi chú",
        ),
      );
    }
    const original = source.pages.map((p) => p.text).join("\n");
    for (const chunk of chunks)
      for (const line of chunk.text.split("\n").filter(Boolean))
        assert.ok(original.includes(line), `Invented source line ${line}`);
  }
  assert.equal(count, 499);
});
// Đoạn văn trải qua nhiều trang phải giữ đúng khoảng trang PDF liên quan.
test("joined paragraphs preserve their full PDF page range", async () => {
  const chunks = await chunkPages(
    sources[0].pages,
    sources[0].title,
    sources[0].scope,
    "TL01",
  );
  const joint = chunks.find((c) =>
    c.text.includes(
      "Liên kết đào tạo đối với các chương trình, ngành thuộc lĩnh vực sức khỏe",
    ),
  );
  assert.ok(joint);
  assert.equal(joint.page, 5);
  assert.equal(joint.pageEnd, 6);
  assert.ok(sources[0].scope.includes("Điều 27"));
});
// Không tự sửa ô trống hoặc giá trị đáng nghi trong tài liệu gốc.
test("suspicious and blank original cells are preserved without correction", async () => {
  const chunks = await chunkPages(
    sources[1].pages,
    sources[1].title,
    sources[1].scope,
    "TL02",
  );
  assert.ok(
    chunks.some((c) =>
      c.text.includes("5. [nguyên văn ô trong bản gốc; không tự suy diễn]"),
    ),
  );
  assert.ok(sources[4].pages[0].text.includes("TL04, trang PDF 1/4"));
});

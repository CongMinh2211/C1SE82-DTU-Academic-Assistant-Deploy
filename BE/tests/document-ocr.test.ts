import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadMime } from "../document-format";
import { extractPdfPages } from "../ocr";

test("nhận Markdown UTF-8 và từ chối tệp nhị phân giả văn bản", () => {
  assert.equal(uploadMime("huong-dan.md", Buffer.from("# Hướng dẫn\nNội dung tiếng Việt")), "text/markdown");
  assert.throws(() => uploadMime("gia.md", Buffer.from([0, 1, 2])));
});

test("OCR trang scan và trang có ảnh, giữ đúng số trang PDF", async () => {
  const parser = {
    getText: async () => ({ total: 3, pages: [{ num: 1, text: "Văn bản gốc đã đủ dài để trích xuất" }, { num: 2, text: "" }, { num: 3, text: "Chữ gốc trên trang này đã đủ dài" }] }),
    getImage: async ({ partial }: { partial: number[] }) => ({ pages: [{ images: partial[0] === 3 ? [{}] : [] }] }),
    getScreenshot: async ({ partial }: { partial: number[] }) => ({ pages: [{ data: new Uint8Array([partial[0]]) }] }),
  };
  const pages = await extractPdfPages(parser as never, async (data) => `Kết quả trang ${data[0]}`);
  assert.deepEqual(pages.map((p) => p.page), [1, 2, 3]);
  assert.equal(pages[0].ocr, undefined);
  assert.match(pages[1].text, /Kết quả trang 2/);
  assert.match(pages[2].text, /Chữ gốc.*[\s\S]*Kết quả trang 3/);
  assert.equal(pages[2].ocr, true);
});

test("không đưa trang scan không đọc được vào kho", async () => {
  const parser = { getText: async () => ({ total: 1, pages: [{ num: 1, text: "" }] }), getImage: async () => ({ pages: [] }), getScreenshot: async () => ({ pages: [{ data: new Uint8Array([1]) }] }) };
  await assert.rejects(extractPdfPages(parser as never, async () => ""), /trang 1/);
});

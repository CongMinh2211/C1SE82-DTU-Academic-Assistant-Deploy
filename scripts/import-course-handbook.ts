// Nhập bản PDF người dùng cung cấp vào kho local, giữ số trang gốc để dẫn nguồn.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pdfParser } from "../BE/pdf";
import { saveRevision } from "../BE/knowledge";
import { db, row } from "../BE/db";

if (process.env.DATABASE_URL || process.env.SOURCE_STORAGE !== "local")
  throw new Error("Chỉ chạy công cụ nhập này với dữ liệu local.");
const file = process.argv[2];
if (!file) throw new Error("Cần chỉ định đường dẫn PDF.");
const bytes = await readFile(file);
const hash = createHash("sha256").update(bytes).digest("hex");
const existing = await row<{ document_id: string; id: string; status: string }>(
  "SELECT r.document_id,r.id,r.status FROM revisions r WHERE r.sha256=? AND r.status NOT IN ('failed','superseded') LIMIT 1", hash,
);
if (existing) {
  console.log(JSON.stringify({ existing }));
} else {
  const parser = await pdfParser(new Uint8Array(bytes));
  try {
    const result = await parser.getText();
    // Trang 15 đã đối chiếu trực quan: chỉ có ảnh và chú thích ngắn, không tự suy diễn chữ trong ảnh.
    if (result.total !== 56 || result.pages.some((p) => p.num !== 15 && p.text.trim().length < 25) || result.pages[14]?.text.trim() !== "Thực hành Thực tế")
      throw new Error("PDF khác bản đã kiểm tra hoặc có trang cần OCR; dừng nhập để rà soát.");
    const imported = await saveRevision({
      title: "Sổ tay học phần",
      topic: "Thông tin học vụ",
      scope: "Tài liệu người dùng cung cấp cho sinh viên các ngành; nguồn khai báo myDTU. Chưa xác minh đường dẫn trực tiếp, ngày ban hành hoặc hiệu lực; cần đối chiếu quy định chính thức hiện hành.",
      kind: "upload",
      url: "https://mydtu.duytan.edu.vn/",
      filename: "so-tay-hoc-phan.pdf",
      mime: "application/pdf",
      bytes,
      pages: result.pages.map((p) => ({ page: p.num, text: p.text })),
    }, "local-import");
    console.log(JSON.stringify(imported));
  } finally { await parser.destroy(); }
}
await db().close();

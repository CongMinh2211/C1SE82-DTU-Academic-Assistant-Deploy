import { spawn } from "node:child_process";
import type { SourcePage } from "./rag/parser";
import type { pdfParser } from "./pdf";

type Parser = Awaited<ReturnType<typeof pdfParser>>;

// Chạy OCR cục bộ trong worker; không gửi hình ảnh hoặc nội dung ra mạng.
export async function recognizeImage(image: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", ["stdin", "stdout", "-l", "vie+eng", "--psm", "3"], { windowsHide: true });
    let result = "";
    // Nhiều sự kiện của tiến trình có thể cùng xảy ra; chỉ hoàn tất Promise một lần.
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result.trim());
    };
    // Dừng tiến trình treo sau 60 giây để worker không bị chiếm vô hạn.
    const timer = setTimeout(() => { child.kill(); finish(new Error("OCR quá thời gian cho phép.")); }, 60000);
    child.on("error", () => finish(new Error("Không thể chạy OCR. Cần cài Tesseract và dữ liệu tiếng Việt, tiếng Anh trên worker.")));
    child.stdout.setEncoding("utf8");
    // Đọc kết quả theo từng phần và giới hạn kích thước để tránh tăng RAM quá mức.
    child.stdout.on("data", (chunk: string) => {
      result += chunk;
      if (result.length > 2_000_000) { child.kill(); finish(new Error("Nội dung OCR vượt giới hạn.")); }
    });
    // Không ghi stderr của công cụ vào log vì có thể chứa nội dung tài liệu.
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("close", (code) => finish(code === 0 ? undefined : new Error("OCR thất bại; kiểm tra Tesseract và dữ liệu ngôn ngữ vie+eng.")));
    child.stdin.end(image);
  });
}

// Chỉ OCR trang thiếu chữ hoặc chứa ảnh lớn; giữ số trang PDF thật để dẫn nguồn.
export async function extractPdfPages(parser: Parser, recognize = recognizeImage): Promise<SourcePage[]> {
  const result = await parser.getText();
  if (result.total > 300) throw new Error("Giới hạn 300 trang mỗi tài liệu.");
  const pages: SourcePage[] = [];
  let ocrPages = 0;
  // Xử lý từng trang riêng để giữ đúng số trang phục vụ trích dẫn về sau.
  for (const page of result.pages) {
    const embedded = await parser.getImage({ partial: [page.num], imageThreshold: 160, imageBuffer: false, imageDataUrl: false });
    // Trang ít chữ hoặc chứa ảnh lớn cần OCR, kể cả khi PDF có sẵn một phần văn bản.
    const needsOcr = page.text.trim().length < 25 || embedded.pages.some((p) => p.images.length > 0);
    if (!needsOcr) { pages.push({ page: page.num, text: page.text }); continue; }
    // Giới hạn số trang OCR cho mỗi tài liệu để tránh một tệp chiếm worker quá lâu.
    if (++ocrPages > 80) throw new Error("Tài liệu vượt giới hạn 80 trang cần OCR; hãy chia nhỏ tài liệu.");
    const rendered = await parser.getScreenshot({ partial: [page.num], desiredWidth: 1800, imageBuffer: true, imageDataUrl: false });
    if (!rendered.pages[0]?.data?.length) throw new Error(`Không thể đọc ảnh trang ${page.num}.`);
    const scanned = await recognize(rendered.pages[0].data);
    // Tránh bỏ sót chữ nằm trong hình khi trang đã có một phần văn bản gốc.
    const original = page.text.trim();
    if (!scanned && original.length < 25) throw new Error(`Không nhận diện được nội dung trang ${page.num}; cần kiểm tra bản gốc.`);
    // Giữ cả chữ gốc và chữ nhận dạng; đánh dấu OCR để người đọc đối chiếu với PDF.
    const text = original && scanned ? `${original}\n\n[Nội dung nhận diện từ ảnh - cần đối chiếu bản gốc]\n${scanned}` : original || scanned;
    pages.push({ page: page.num, text, ocr: Boolean(scanned) });
  }
  return pages;
}

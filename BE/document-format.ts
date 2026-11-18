import { HttpError } from "./http";

export const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Không tin riêng phần mở rộng: kiểm tra chữ ký file trước khi đưa vào hàng đợi.
export function uploadMime(filename: string, bytes: Buffer) {
  if (bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
    return "application/pdf";
  if (
    filename.toLowerCase().endsWith(".docx") &&
    bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  )
    return docxMime;
  if (/\.(txt|md|markdown)$/i.test(filename)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("Văn bản chứa byte rỗng.");
      return /\.(md|markdown)$/i.test(filename) ? "text/markdown" : "text/plain";
    } catch {
      /* Báo định dạng không hợp lệ bên dưới. */
    }
  }
  throw new HttpError(415, "Chỉ nhận PDF, DOCX, TXT hoặc Markdown UTF-8 hợp lệ.");
}

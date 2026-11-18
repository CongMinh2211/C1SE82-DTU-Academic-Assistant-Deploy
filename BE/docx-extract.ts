import { fromBuffer } from "yauzl";

// Đọc metadata ZIP trước khi giải nén để giới hạn kích thước và tránh tệp nén gây cạn bộ nhớ.
export async function extractDocx(bytes: Buffer, allowEmpty = false): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(new Error("DOCX không hợp lệ."));
      let total = 0,
        count = 0,
        documentFound = false;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        total += entry.uncompressedSize;
        count++;
        if (entry.fileName === "word/document.xml") documentFound = true;
        if (entry.isEncrypted() || count > 5000 || total > 64 * 1024 * 1024) {
          zip.close();
          reject(new Error("DOCX mã hóa hoặc vượt giới hạn giải nén."));
          return;
        }
        zip.readEntry();
      });
      zip.on("end", () =>
        documentFound
          ? resolve()
          : reject(new Error("DOCX thiếu nội dung văn bản.")),
      );
      zip.readEntry();
    });
  });
  const mammoth = await import("mammoth");
  const text = (await mammoth.extractRawText({ buffer: bytes })).value.trim();
  if ((!allowEmpty && text.length < 25) || text.length > 2_000_000)
    throw new Error("DOCX không có đủ văn bản hoặc vượt giới hạn xử lý.");
  return text;
}

// Đọc ảnh nhúng từ DOCX sau khi đã kiểm tra kích thước ZIP; không ghi ảnh ra ổ đĩa.
export async function docxImages(bytes: Buffer): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(new Error("DOCX không hợp lệ."));
      const images: Buffer[] = [];
      let total = 0;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        if (!/^word\/media\/.*\.(png|jpe?g|tiff?)$/i.test(entry.fileName)) { zip.readEntry(); return; }
        total += entry.uncompressedSize;
        if (images.length >= 30 || entry.uncompressedSize > 10 * 1024 * 1024 || total > 40 * 1024 * 1024) {
          zip.close(); reject(new Error("Ảnh trong DOCX vượt giới hạn OCR.")); return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { reject(new Error("Không đọc được ảnh trong DOCX.")); return; }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => { images.push(Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.on("end", () => resolve(images));
      zip.readEntry();
    });
  });
}

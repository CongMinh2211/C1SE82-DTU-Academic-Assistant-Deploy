// Nhập ba hướng dẫn được người dùng cung cấp; chỉ chạy trên bản local.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db, row } from "../BE/db";
import { saveRevision } from "../BE/knowledge";
if (process.env.DATABASE_URL || process.env.SOURCE_STORAGE !== "local")
  throw new Error("Chỉ chạy với kho local.");
const guides = [
  [
    "sakai-student.pdf",
    "Hướng dẫn sử dụng Sakai cho sinh viên",
    "Hướng dẫn Sakai năm 2021; giao diện và quy trình hiện tại có thể đã thay đổi.",
  ],
  [
    "zoom-student.pdf",
    "Hướng dẫn sử dụng Zoom cho sinh viên",
    "Hướng dẫn Zoom năm 2020; giao diện và quy trình hiện tại có thể đã thay đổi.",
  ],
  [
    "zoom-dtu-email.pdf",
    "Hướng dẫn đăng ký Zoom với email DTU",
    "Tài liệu người dùng cung cấp; giao diện và chính sách tài khoản hiện tại cần đối chiếu với nhà trường.",
  ],
];
for (const [filename, title, scope] of guides) {
  const bytes = await readFile(`/app/knowledge/originals/${filename}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const existing = await row<{ id: string; status: string }>(
    "SELECT id,status FROM revisions WHERE sha256=? AND status NOT IN ('failed','superseded') LIMIT 1",
    hash,
  );
  if (existing) {
    console.log(JSON.stringify({ title, existing }));
    continue;
  }
  const result = await saveRevision(
    {
      title,
      scope,
      filename,
      topic: "Hướng dẫn học tập",
      kind: "upload",
      mime: "application/pdf",
      bytes,
    },
    "local-import",
  );
  console.log(JSON.stringify({ title, ...result }));
}
await db().close();

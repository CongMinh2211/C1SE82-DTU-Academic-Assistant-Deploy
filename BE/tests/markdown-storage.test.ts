import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Dùng kho và cơ sở dữ liệu tạm, không thay đổi tài liệu thật của dự án.
const dir = await mkdtemp(path.join(tmpdir(), "dtu-markdown-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
delete process.env.SOURCE_STORAGE;
delete process.env.VERCEL;
const { saveRevision, extract } = await import("../knowledge");
const { db, row } = await import("../db");
const { readSource, openSource, sourcePath } = await import("../source-storage");
const { chunkPages } = await import("../rag/parser");
const { uploadMime } = await import("../document-format");

test("lưu Markdown, đọc file gốc và chia đoạn có mục trích dẫn", async () => {
  const source = "# Hướng dẫn học vụ\n\nSinh viên xem thời khóa biểu trong cổng myDTU.\n\n## Đăng ký học phần\n\nSinh viên xem hướng dẫn đăng ký trong tài liệu này.";
  const bytes = Buffer.from(source, "utf8");
  const created = await saveRevision({title:"Hướng dẫn học vụ",topic:"Học vụ",scope:"Sinh viên theo tài liệu này",kind:"upload",filename:"huong-dan.md",mime:uploadMime("huong-dan.md",bytes),bytes},"admin-test");
  const revision = await row<{raw_path:string;mime:string;status:string;pages_json:string|null;id:string;document_id:string;version:number;title:string;scope:string;source_kind:string}>("SELECT id,document_id,version,raw_path,mime,status,pages_json,title_snapshot title,scope_snapshot scope,'upload' source_kind FROM revisions WHERE id=?",created.revisionId);
  assert.ok(revision); assert.equal(revision.mime,"text/markdown"); assert.match(revision.raw_path,/\.md$/);
  assert.notEqual(revision.status,"published");
  assert.equal((await readSource(revision.raw_path)).toString("utf8"),source);
  assert.equal(await new Response(await openSource(revision.raw_path)).text(),source);
  const pages = await extract(revision);
  const chunks = await chunkPages(pages,"Hướng dẫn học vụ","Sinh viên",created.revisionId);
  assert.ok(chunks.some(c=>c.text.includes("đăng ký trong tài liệu") && c.section === "Đăng ký học phần"));
  assert.throws(()=>sourcePath("sources/../../outside.md"));
  assert.throws(()=>sourcePath("sources/invalid.exe"));
});
test.after(async()=>{await db().close();await rm(dir,{recursive:true,force:true});});

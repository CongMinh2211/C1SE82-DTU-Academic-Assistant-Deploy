import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chunkPages } from "../rag/parser";
import { extractPdfPages } from "../ocr";

const dir = await mkdtemp(path.join(tmpdir(), "dtu-ocr-retrieval-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
const { db, row } = await import("../db");
const { queueReindex } = await import("../knowledge");
const { exactTuitionEvidence } = await import("../rag/retrieve");
const dbx = db();

test("đoạn OCR được chia, lưu và truy xuất kèm đúng phiên bản và trang", async () => {
  const parser = { getText: async () => ({ total: 1, pages: [{ num: 4, text: "" }] }), getImage: async () => ({ pages: [] }), getScreenshot: async () => ({ pages: [{ data: new Uint8Array([1]) }] }) };
  const pages = await extractPdfPages(parser as never, async () => "Digital Marketing | 402 | 123456 đồng mỗi tín chỉ");
  const chunks = await chunkPages(pages, "Học phí", "K29", "revision");
  await dbx.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("doc","Học phí","Học phí","upload","revision","2026","2026");
  await dbx.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at,pages_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("revision","doc",1,"hash","sources/test.pdf","application/pdf","Học phí","K29","published","2026",JSON.stringify(pages));
  for (const c of chunks) await dbx.prepare("INSERT INTO chunks(id,revision_id,document_id,page,page_end,section,text,search_text,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run(c.id,"revision","doc",c.page,c.pageEnd,c.section,c.text,c.searchText,"{}");
  const found = await exactTuitionEvidence("Học phí ngành 402 là bao nhiêu?");
  assert.ok(found.some(e => e.revisionId === "revision" && e.page === 4 && e.text.includes("123456")));
});

test("Markdown cũng được chia đoạn và truy xuất cùng nguồn đã công bố", async () => {
  const pages = [{page: 1, text: "# Học phí Digital Marketing\n\nDigital Marketing | 402 | 654321 đồng mỗi tín chỉ"}];
  const chunks = await chunkPages(pages, "Học phí Markdown", "K29", "md-revision");
  await dbx.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("md-doc","Học phí Markdown","Học phí","upload","md-revision","2026","2026");
  await dbx.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at,pages_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("md-revision","md-doc",1,"md-hash","sources/test.md","text/markdown","Học phí Markdown","K29","published","2026",JSON.stringify(pages));
  for (const c of chunks) await dbx.prepare("INSERT INTO chunks(id,revision_id,document_id,page,page_end,section,text,search_text,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run(c.id,"md-revision","md-doc",c.page,c.pageEnd,c.section,c.text,c.searchText,"{}");
  const found = await exactTuitionEvidence("Học phí ngành 402 là bao nhiêu?");
  assert.ok(found.some(e => e.revisionId === "md-revision" && e.text.includes("654321")));
});

test("lập chỉ mục lại PDF tạo bản chờ duyệt và chạy OCR lại", async () => {
  await queueReindex("revision", "test-admin");
  const newRevision = await row<{ pages_json: string | null; status: string }>("SELECT pages_json,status FROM revisions WHERE document_id=? AND version=2", "doc");
  assert.equal(newRevision?.pages_json, null);
  assert.notEqual(newRevision?.status, "published");
  const active = await row<{active_revision:string}>("SELECT active_revision FROM documents WHERE id=?", "doc");
  assert.equal(active?.active_revision, "revision");
});
test.after(async () => { await dbx.close(); await rm(dir,{recursive:true,force:true}); });

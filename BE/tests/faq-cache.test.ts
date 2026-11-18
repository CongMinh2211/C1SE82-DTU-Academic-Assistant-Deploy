import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
// Dùng CSDL tạm riêng để test không sửa dữ liệu thực tế của dự án.
const dir=await mkdtemp(path.join(tmpdir(),"faq-cache-"));process.env.APP_DATA_DIR=dir;delete process.env.DATABASE_URL;
const {db}=await import("../db");const {lookupApprovedFaq}=await import("../rag/faq-answer");const d=db();
await d.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("d","Nguồn","Học vụ","upload","r","2026","2026");
await d.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at,issued_on,effective_from,effective_until) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("r","d",1,"hash","source.txt","text/plain","Nguồn","Sinh viên","published","2026","2025-01-01","2025-01-01","2099-12-31");
await d.prepare("INSERT INTO chunks(id,revision_id,document_id,page,page_end,section,text,search_text,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run("c","r","d",1,1,"Mục","Nguồn học vụ hợp lệ","nguon hoc vu","{}");
await d.prepare("INSERT INTO faqs(id,question,answer,topic,source_chunk,status,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("f","Hỏi gì?","Câu trả lời ban đầu","Học vụ","c","published","a","2026");
test("FAQ thay đổi hoặc gỡ nguồn không dùng lại câu trả lời cũ",async()=>{
 assert.match((await lookupApprovedFaq("Hỏi gì?"))!.content,/ban đầu/);
 assert.match((await lookupApprovedFaq("Hỏi gì?"))!.content,/ban đầu/);
 // Sửa FAQ sau khi đã đọc từ cache; lần đọc kế tiếp phải thấy nội dung mới.
 await d.prepare("UPDATE faqs SET answer=? WHERE id=?").run("Câu trả lời mới","f");
 assert.match((await lookupApprovedFaq("Hỏi gì?"))!.content,/mới/);
 // Khi nguồn hết hiệu lực, FAQ không còn đủ điều kiện trả lời trực tiếp.
 await d.prepare("UPDATE revisions SET effective_until=? WHERE id=?").run("2025-12-31","r");
 assert.equal(await lookupApprovedFaq("Hỏi gì?"),null);
 await d.prepare("UPDATE revisions SET effective_until=? WHERE id=?").run("2099-12-31","r");
 assert.match((await lookupApprovedFaq("Hỏi gì?"))!.content,/mới/);
 // Xóa mềm tài liệu nguồn cũng phải khiến FAQ không còn được sử dụng.
 await d.prepare("UPDATE documents SET deleted_at=? WHERE id=?").run("2026","d");
 assert.equal(await lookupApprovedFaq("Hỏi gì?"),null);
});
test.after(async()=>{await d.close();await rm(dir,{recursive:true,force:true});});


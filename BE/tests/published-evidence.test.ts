// Kiểm thử CSDL tạm: nguồn chưa công bố không được lọt vào đường tìm học phí chính xác.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "dtu-published-evidence-"));
process.env.APP_DATA_DIR = dir;
process.env.DATABASE_URL = "";
const { db } = await import("../sqlite");
const { isPreferredSource } = await import("../rag/source-preference");
const { exactTuitionEvidence } = await import("../rag/retrieve");
const database = db();

test("chỉ trả đoạn của phiên bản đang công bố và đúng tài liệu", async () => {
  // Mỗi bản ghi giữ nguyên vị trí trang để kiểm tra dữ liệu trả về có thể trích dẫn.
  const insertDoc = database.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)");
  const insertRev = database.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const insertChunk = database.prepare("INSERT INTO chunks(id,revision_id,document_id,page,page_end,section,text,search_text,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)");
  for (const [key, status, deleted] of [["published","published",false],["draft","ready",false],["removed","published",true]] as const) {
    insertDoc.run(key,key,"Học phí","upload",key+"-v1","2026","2026");
    insertRev.run(key+"-v1",key,1,key,"sources/a.pdf","application/pdf",key,"scope",status,"2026");
    insertChunk.run(key+"-chunk",key+"-v1",key,4,4,"Bảng học phí","Digital Marketing | 402 | 123","digital marketing", "{}");
    if (deleted) database.prepare("UPDATE documents SET deleted_at=? WHERE id=?").run("2026",key);
  }
  // Phiên bản đã xuất bản nhưng hết hạn hoặc chưa tới ngày hiệu lực không được truy xuất.
  for (const [key, start, end] of [["expired", "2020-01-01", "2020-12-31"], ["future", "2099-01-01", "2099-12-31"]]) {
    insertDoc.run(key,key,"Học phí","upload",key+"-v1","2026","2026");
    insertRev.run(key+"-v1",key,1,key,"sources/a.pdf","application/pdf",key,"scope","published","2026");
    database.prepare("UPDATE revisions SET effective_from=?,effective_until=? WHERE id=?").run(start,end,key+"-v1");
    insertChunk.run(key+"-chunk",key+"-v1",key,4,4,"Bảng học phí","Digital Marketing | 402 | 123","digital marketing", "{}");
  }
  const evidence = await exactTuitionEvidence("Học phí ngành 402 là bao nhiêu?");
  assert.deepEqual(evidence.map(e => e.documentId), ["published"]);
  assert.equal(evidence[0].page, 4);
  assert.equal(evidence[0].revisionId, "published-v1");
});
test("không dùng nhánh trả lời nhanh từ bản cũ khi đã có nguồn mới cùng phạm vi", async () => {
  database.prepare("UPDATE revisions SET issued_on=?,effective_from=?,effective_until=?,scope_key=? WHERE id=?").run("2022-01-01","2022-01-01","2099-12-31","k29","published-v1");
  database.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("new","Mới","Học phí","upload","new-v1","2026","2026");
  database.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at,issued_on,effective_from,effective_until,scope_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("new-v1","new",1,"new","sources/new.pdf","application/pdf","Mới","scope","published","2026","2024-01-01","2024-01-01","2099-12-31","k29");
  const old = {issued_on:"2022-01-01",effective_from:"2022-01-01",effective_until:"2099-12-31",scope_key:"k29"};
  assert.equal(await isPreferredSource(old,"Học phí hiện nay"), false);
  assert.equal(await isPreferredSource(old,"Học phí năm 2022"), true);
  assert.equal(await isPreferredSource({scope_key:"k29"},"Học phí hiện nay"), false);
});
test.after(async () => {database.close(); await rm(dir,{recursive:true,force:true});});

// Kiểm tra nguồn hồ sơ cá nhân khi web bị tắt hoặc danh bạ chưa được công bố.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = await mkdtemp(path.join(tmpdir(), "dtu-profile-source-"));
process.env.APP_DATA_DIR = dir;
process.env.DATABASE_URL = "";
const { db } = await import("../sqlite");
const { lecturerProfileAnswer } = await import("../rag/lecturer-profile");
const database = db();
const url = "https://is.duytan.edu.vn/international-school/27-tran-kim-sanh";
test("danh bạ đã công bố trỏ chính xác hồ sơ Sanh khi tắt tìm web", async () => {
  database.prepare("INSERT INTO documents(id,title,topic,source_kind,active_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("d","Danh bạ","Giảng viên","web","r","2026","2026");
  const pages = JSON.stringify([{page:1,text:`Họ tên: Trần Kim Sanh\nĐiện thoại theo nguồn: 0987 409 464\nNguồn gốc: ${url}`}]);
  database.prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,pages_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("r","d",1,"hash","source.txt","text/plain","Danh bạ","", "published",pages,"2026");
  const answer = await lecturerProfileAnswer("số điện thoại thầy Trần Kim Sanh", false);
  assert.equal(answer?.citations[0].url, url);
  assert.match(answer!.content, /chưa|đã lưu/);
  database.prepare("UPDATE revisions SET status='ready' WHERE id='r'").run();
  assert.equal(await lecturerProfileAnswer("số điện thoại thầy Trần Kim Sanh", false), null);
});
test.after(async () => { database.close(); await rm(dir,{recursive:true,force:true}); });
test("chỉ nhập họ tên với từ đệm vẫn dẫn đúng hồ sơ cá nhân", async () => {
  database.prepare("UPDATE revisions SET status='published' WHERE id='r'").run();
  const result = await lecturerProfileAnswer("Trần Kim Sanh á", false);
  assert.equal(result?.citations[0].url, url);
  assert.equal(await lecturerProfileAnswer("xin chào", false), null);
});
test("hỏi ngắn và hỏi giải thích tiếp vẫn giữ hồ sơ cụ thể", async () => {
  database.prepare("UPDATE revisions SET status='published' WHERE id='r'").run();
  const { answerQuestion } = await import("../rag/answer");
  const first = await answerQuestion("thông tin thầy Sanh", [], false);
  assert.equal(first.citations[0]?.url, url);
  const next = await answerQuestion("Giải thích rõ hơn câu trả lời vừa rồi và giữ đúng nguồn nếu có.", [
    { role: "user", content: "thông tin thầy Sanh" },
    { role: "assistant", content: first.content },
  ], false);
  assert.equal(next.citations[0]?.url, url);
});

// Kiểm thử lưu ngôn ngữ theo từng tài khoản và bảo vệ giá trị trong CSDL tạm.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir=await mkdtemp(path.join(tmpdir(),"dtu-language-"));
process.env.APP_DATA_DIR=dir; process.env.DATABASE_URL="";
const {db}=await import("../sqlite"); const database=db();
test("lựa chọn lưu theo người dùng, cập nhật độc lập và xóa cùng tài khoản",()=>{
  database.exec('CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY)');
  database.prepare('INSERT INTO "user"(id) VALUES(?)').run("user-a");
  database.prepare('INSERT INTO "user"(id) VALUES(?)').run("user-b");
  const save=database.prepare("INSERT INTO user_language_preferences(user_id,ui_language,answer_language,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ui_language=excluded.ui_language,answer_language=excluded.answer_language,updated_at=excluded.updated_at");
  save.run("user-a","en","hi","2026-11-10"); save.run("user-b","vi","auto","2026-11-10");
  assert.deepEqual(database.prepare("SELECT ui_language,answer_language FROM user_language_preferences WHERE user_id=?").get("user-a"),{ui_language:"en",answer_language:"hi"});
  assert.throws(()=>save.run("user-a","xx","auto","2026"));
  database.prepare('DELETE FROM "user" WHERE id=?').run("user-a");
  assert.equal(database.prepare("SELECT * FROM user_language_preferences WHERE user_id=?").get("user-a"),undefined);
  assert.ok(database.prepare("SELECT * FROM user_language_preferences WHERE user_id=?").get("user-b"));
});
test.after(async()=>{database.close(); await rm(dir,{recursive:true,force:true});});

// Kiểm thử API metadata trên CSDL tạm; không chạm nguồn thực tế.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMigrations } from "better-auth/db/migration";
const dir = await mkdtemp(path.join(tmpdir(), "dtu-validity-test-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET = "test-validity-secret-12345678901234567890";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.EMAIL_OTP_ENABLED = "false";
const {getAuth} = await import("../auth");
const {db, row} = await import("../db");
const {patchResource} = await import("../api/patch");
const auth = getAuth();
await (await getMigrations(auth.options)).runMigrations();
const password = "test-password-12345";
const admin = await auth.api.signUpEmail({body:{name:"Admin test",email:"admin-validity@example.test",password}});
await db().prepare("UPDATE user SET role='admin' WHERE id=?").run(admin.user.id);
await auth.api.signUpEmail({body:{name:"Student test",email:"student-validity@example.test",password}});
async function cookie(email:string) { const r = await auth.api.signInEmail({body:{email,password},asResponse:true}); return r.headers.getSetCookie().map(v=>v.split(";")[0]).join("; "); }
const adminCookie = await cookie("admin-validity@example.test"), studentCookie = await cookie("student-validity@example.test");
await db().prepare("INSERT INTO documents(id,title,topic,source_kind,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("doc","Nguồn test","Học phí","upload","2026","2026");
await db().prepare("INSERT INTO revisions(id,document_id,version,sha256,raw_path,mime,title_snapshot,scope_snapshot,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("rev","doc",1,"sha","source.pdf","application/pdf","Nguồn test","K29","published","2026");
const body = {issuedOn:"2026-01-01",effectiveFrom:"2026-02-01",effectiveUntil:"2027-01-01",scopeKey:"k29-cmu"};
function request(c:string, value:unknown) {return new Request("http://localhost:3000/api/app/admin/revisions/rev/validity",{method:"PATCH",headers:{cookie:c,origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify(value)});}
test("chỉ admin được cập nhật và kiểm tra khoảng ngày", async () => {
  await assert.rejects(patchResource(request(studentCookie,body)),(e:unknown)=>(e as {status?:number}).status===403);
  await assert.rejects(patchResource(request(adminCookie,{...body,effectiveUntil:"2025-01-01"})),(e:unknown)=>(e as {status?:number}).status===400);
  assert.deepEqual(await patchResource(request(adminCookie,body)),{ok:true});
  const result = await row<{issued_on:string;effective_from:string;scope_key:string}>("SELECT issued_on,effective_from,scope_key FROM revisions WHERE id=?","rev");
  assert.deepEqual(result,{issued_on:"2026-01-01",effective_from:"2026-02-01",scope_key:"k29-cmu"});
});
test.after(async()=>{await db().close(); await rm(dir,{recursive:true,force:true});});

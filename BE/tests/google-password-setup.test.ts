import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import {getMigrations} from "better-auth/db/migration";
const dir=await mkdtemp(path.join(tmpdir(),"dtu-google-password-"));
process.env.APP_DATA_DIR=dir;delete process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET="test-secret-please-use-32-bytes-minimum-123456789";
process.env.BETTER_AUTH_URL="http://localhost:3000";
process.env.EMAIL_OTP_ENABLED="true";process.env.SMTP_HOST="smtp.example.test";process.env.SMTP_USER="sender@example.test";process.env.SMTP_PASSWORD="test-only";
let sent="";const original=nodemailer.createTransport;
nodemailer.createTransport=(()=>({sendMail:async (mail:{text:string})=>{sent=mail.text;},close(){}})) as unknown as typeof nodemailer.createTransport;
const {getAuth}=await import("../auth");const {db}=await import("../db");const auth=getAuth();await (await getMigrations(auth.options)).runMigrations();
const email="google-only@example.test", initial="initial-test-password-123", next="new-test-password-456";
const registered=await auth.api.signUpEmail({body:{email,password:initial,name:"Google test"}});
const login=await auth.api.signInEmail({body:{email,password:initial},asResponse:true});
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const database=db();await database.prepare('UPDATE account SET providerId=?,accountId=?,password=NULL WHERE userId=?').run("google","fake-google-subject",registered.user.id);
function request(path:string,body:object){return new Request(`http://localhost:3000/api/auth/${path}`,{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",cookie},body:JSON.stringify(body)});}
function currentOtp(){const match=sent.match(/\b\d{6}\b/);assert.ok(match);return match[0];}
test("không thể gỡ phương thức Google duy nhất",async()=>{
 const google=await database.prepare("SELECT id FROM account WHERE userId=? AND providerId=?").get(registered.user.id,"google") as {id:string};
 const response=await auth.handler(request("unlink-account",{accountId:google.id}));assert.equal(response.status,400);
});
test("OTP sai và hết hạn không tạo được mật khẩu",async()=>{
 await auth.api.requestPasswordResetEmailOTP({body:{email}});const code=currentOtp();
 await assert.rejects(auth.api.resetPasswordEmailOTP({body:{email,otp:code==="000000"?"000001":"000000",password:next}}));
 await database.prepare("UPDATE verification SET expiresAt=? WHERE identifier=?").run(0,`forget-password-otp-${email}`);
 await assert.rejects(auth.api.resetPasswordEmailOTP({body:{email,otp:code,password:next}}));
 assert.equal((await database.prepare('SELECT count(*) n FROM account WHERE userId=? AND providerId=?').get(registered.user.id,"credential") as {n:number}).n,0);
});
test("xác minh đúng tạo mật khẩu ứng dụng, giữ Google và thu hồi phiên cũ",async()=>{
 await auth.api.requestPasswordResetEmailOTP({body:{email}});const code=currentOtp();
 await auth.api.resetPasswordEmailOTP({body:{email,otp:code,password:next}});
 const rows=await database.prepare('SELECT providerId FROM account WHERE userId=?').all(registered.user.id) as {providerId:string}[];
 assert.deepEqual(rows.map(r=>r.providerId).sort(),["credential","google"]);
 assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
 assert.ok((await auth.api.signInEmail({body:{email,password:next}})).user);
 await assert.rejects(auth.api.resetPasswordEmailOTP({body:{email,otp:code,password:next}}));
});
test("có mật khẩu thì được gỡ Google nhưng không gỡ phương thức cuối",async()=>{
 const current=await auth.api.signInEmail({body:{email,password:next},asResponse:true});
 const currentCookie=current.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
 const call=async (providerId:string)=>{
  const account=await database.prepare("SELECT id FROM account WHERE userId=? AND providerId=?").get(registered.user.id,providerId) as {id:string};
  return auth.handler(new Request("http://localhost:3000/api/auth/unlink-account",{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",cookie:currentCookie},body:JSON.stringify({accountId:account.id})}));
 };
 assert.equal((await call("google")).status,200);
 assert.equal((await call("credential")).status,400);
 assert.ok((await auth.api.signInEmail({body:{email,password:next}})).user);
});
test.after(async()=>{nodemailer.createTransport=original;await database.close();await rm(dir,{recursive:true,force:true});});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMigrations } from "better-auth/db/migration";
// Tạo môi trường và CSDL tạm; khóa dưới đây là chuỗi giả, không gọi Gemini thật.
const dir = await mkdtemp(path.join(tmpdir(),"dtu-voice-test-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET="test-voice-secret-123456789012345678901";
process.env.BETTER_AUTH_URL="http://localhost:3000";
process.env.GEMINI_API_KEY="test-key-not-real";
const { getAuth }=await import("../auth");
const { db }=await import("../db");
const { transcribeVoice,validAudio }=await import("../voice");
const auth=getAuth();
await (await getMigrations(auth.options)).runMigrations();
const password="test-password-12345";
await auth.api.signUpEmail({body:{name:"Voice test",email:"voice@example.test",password}});
const login=await auth.api.signInEmail({body:{email:"voice@example.test",password},asResponse:true});
const cookie=login.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
const audio=new Uint8Array([0x1a,0x45,0xdf,0xa3,0x01,0x02]);
function request(bytes:Uint8Array=audio,language="vi",authenticated=true) {
  const data=new FormData();data.append("audio",new Blob([bytes as BlobPart],{type:"audio/webm"}),"voice.webm");data.append("language",language);
  return new Request("http://localhost:3000/api/app/voice/transcribe",{method:"POST",headers:{origin:"http://localhost:3000",...(authenticated?{cookie}:{})},body:data});
}
test("nhận dạng âm thanh đúng định dạng và xử lý tiếng Việt qua nhà cung cấp",async()=>{
  let sent=false;
  // Giả lập phản hồi nhà cung cấp để kiểm tra request và nội dung mà không gửi âm thanh ra mạng.
  const provider:typeof fetch=async (_url, init)=>{sent=true; const body=JSON.parse(String(init?.body));assert.equal(body.contents[0].parts[1].inline_data.mime_type,"audio/webm");return Response.json({candidates:[{content:{parts:[{text:"Học phí ngành này bao nhiêu?"}]}}]});};
  assert.deepEqual(await transcribeVoice(request(),provider),{text:"Học phí ngành này bao nhiêu?"});assert.equal(sent,true);
});
test("từ chối tệp sai, ngôn ngữ sai và người chưa đăng nhập",async()=>{
  // Kiểm tra chữ ký tệp, ngôn ngữ và phiên đăng nhập trước khi cho phép xử lý âm thanh.
  assert.equal(validAudio(new Uint8Array([0]),"audio/webm"),false);
  await assert.rejects(transcribeVoice(request(new Uint8Array([1,2,3]))),(e:unknown)=>(e as {status?:number}).status===415);
  await assert.rejects(transcribeVoice(request(audio,"fr")),(e:unknown)=>(e as {status?:number}).status===400);
  await assert.rejects(transcribeVoice(request(audio,"vi",false)),(e:unknown)=>(e as {status?:number}).status===401);
});
test("hết hạn mức hoặc không có lời nói trả lỗi rõ ràng",async()=>{
  // Quota 429 và kết quả không có lời nói phải trả hai lỗi có ý nghĩa khác nhau.
  await assert.rejects(transcribeVoice(request(audio,"en"),async()=>new Response("",{status:429})),(e:unknown)=>(e as {status?:number}).status===429);
  await assert.rejects(transcribeVoice(request(),async()=>Response.json({candidates:[{content:{parts:[{text:"[NO_SPEECH]"}]}}]})),(e:unknown)=>(e as {status?:number}).status===422);
});
test.after(async()=>{await db().close();await rm(dir,{recursive:true,force:true});});

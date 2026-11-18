import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { origin, call } from "./cloud-http.mjs";
import { academicTopics } from "../FE/lib/academic-topics.ts";
const results=[];
async function check(id,run){const started=Date.now();try{const detail=await run();results.push({id,passed:true,latencyMs:Date.now()-started,...detail});console.log(JSON.stringify({id,passed:true}));}catch(error){results.push({id,passed:false,error:error.message,latencyMs:Date.now()-started});await save();throw new Error(`Cloud review QC failed: ${id}: ${error.message}`);}await save();}
async function save(){await writeFile("test-results/cloud-review-quality.json",JSON.stringify({at:new Date().toISOString(),origin,passed:results.every(r=>r.passed),total:results.length,results},null,2));}
const old=JSON.parse(await readFile("config/credentials/cloud-qa.json","utf8"));let admin,cookie,baseline,qa,tuitionMessage,sourceFaqs=[];
await check("migrated-admin-and-original-corpus",async()=>{
 const login=await call("/api/auth/sign-in/email",{method:"POST",body:old.admin});assert.equal(login.status,200);admin=login.cookie;
 const r=await call("/api/app/admin/stats",{cookie:admin});assert.equal(r.status,200);baseline={published:r.payload.published,chunks:r.payload.chunks};assert.equal(baseline.published,8);assert.equal(baseline.chunks,1127);return baseline;
});
await check("isolated-student-registration-and-role-guards",async()=>{
 qa={origin:"https://dtu-academic-assistant.vercel.app",student:{email:`review-qc-${randomUUID().slice(0,8)}@example.test`,password:randomUUID()+randomUUID()}};
 const r=await call("/api/auth/sign-up/email",{method:"POST",body:{...qa.student,name:"Sinh viên QC review"}});assert.equal(r.status,200);cookie=r.cookie;assert.equal((await call("/api/app/admin/analytics?days=7",{cookie})).status,403);assert.equal((await call("/api/app/me")).status,401);
 await writeFile("config/credentials/review-qa.json",JSON.stringify(qa,null,2),{mode:0o600});
});
await check("profile-edit-persistence-and-protected-fields",async()=>{
 const profile={name:"Sinh viên QC hồ sơ",studentCode:"QA20261027",cohort:"29",major:"Hệ thống thông tin quản lý"};
 assert.equal((await call("/api/app/me",{cookie,method:"POST",body:profile})).status,200);
 const r=await call("/api/app/me",{cookie});assert.equal(r.payload.user.name,profile.name);assert.equal(r.payload.user.studentCode,profile.studentCode);assert.equal(r.payload.user.cohort,"K29");assert.equal(r.payload.user.major,profile.major);assert.equal(r.payload.user.email,qa.student.email);assert.equal(r.payload.user.role,"user");
 for(const extra of [{role:"admin"},{email:"invalid@example.test"}]) assert.equal((await call("/api/app/me",{cookie,method:"POST",body:{...profile,...extra}})).status,400);
});
await check("settings-password-and-other-session-revocation",async()=>{
 const second=await call("/api/auth/sign-in/email",{method:"POST",body:qa.student});assert.equal(second.status,200);
 const password=randomUUID()+randomUUID(),bad=await call("/api/auth/change-password",{cookie,method:"POST",body:{currentPassword:"wrong-current-password",newPassword:password,revokeOtherSessions:true}});assert.ok([400,401].includes(bad.status));
 const changed=await call("/api/auth/change-password",{cookie,method:"POST",body:{currentPassword:qa.student.password,newPassword:password,revokeOtherSessions:true}});assert.equal(changed.status,200);
 qa.student.password=password;await writeFile("config/credentials/review-qa.json",JSON.stringify(qa,null,2),{mode:0o600});
 assert.equal((await call("/api/app/me",{cookie:second.cookie})).status,401);
 const login=await call("/api/auth/sign-in/email",{method:"POST",body:qa.student});assert.equal(login.status,200);cookie=login.cookie;assert.equal((await call("/api/app/me",{cookie})).payload.user.cohort,"K29");
 const settings=await call("/sinh-vien/cai-dat",{cookie});assert.equal(settings.status,200);assert.match(await settings.response.text(),/Xác nhận mật khẩu mới/);
 const profile=await call("/sinh-vien/tai-khoan",{cookie});assert.doesNotMatch(await profile.response.text(),/name="current"/);
});
await check("four-chat-topics-and-requested-removals",async()=>{
 const r=await call("/sinh-vien/hoi-dap",{cookie});assert.equal(r.status,200);const html=await r.response.text();for(const topic of academicTopics)assert.ok(html.includes(topic.label));
 for(const removed of ["Tra cứu có nguồn","Thử lập lịch ôn thi","Enter để gửi · Shift + Enter xuống dòng"])assert.ok(!html.includes(removed));
});
await check("chat-greeting-and-cohort-fee-with-period",async()=>{
 const greeting=await call("/api/app/chat",{cookie,method:"POST",body:{question:"Xin chào",requestId:randomUUID(),useWeb:false}});assert.equal(greeting.status,200);assert.equal(greeting.payload.messages.at(-1).status,"conversation");
 const r=await call("/api/app/chat",{cookie,method:"POST",body:{question:"Học phí K29 mã 410(CMU) năm học 2026-2027 là bao nhiêu? Cho học kỳ và tín chỉ.",requestId:randomUUID(),useWeb:false}});assert.equal(r.status,200);tuitionMessage=r.payload.messages.at(-1);assert.equal(tuitionMessage.status,"answered");const normalized=tuitionMessage.content.replace(/[.,\s]/g,"");assert.ok(normalized.includes("14900000")&&normalized.includes("931250"));assert.match(tuitionMessage.content,/2026[–-]2027/);assert.ok(tuitionMessage.citations.some(c=>c.documentId==="TL06"));
 return {conversation:r.payload.id,message:tuitionMessage.id};
});
await check("real-analytics-and-status-counts",async()=>{
 for(const days of [7,30,90]){const r=await call(`/api/app/admin/analytics?days=${days}`,{cookie:admin});assert.equal(r.status,200);assert.equal(r.payload.daily.length,days);assert.equal(r.payload.daily.reduce((n,d)=>n+d.count,0),r.payload.total);assert.equal(r.payload.topics.reduce((n,t)=>n+t.count,0),r.payload.total);assert.ok(r.payload.topics.some(t=>t.label==="Trò chuyện"&&t.count>0));}
 const filtered=await call("/api/app/admin/analytics?days=7&topic="+encodeURIComponent("Học phí"),{cookie:admin});assert.equal(filtered.status,200);assert.ok(filtered.payload.total>0);assert.ok(filtered.payload.topics.every(t=>t.label==="Học phí"||t.count===0));
 assert.equal((await call("/api/app/admin/analytics?days=8",{cookie:admin})).status,400);
 const stats=await call("/api/app/admin/stats",{cookie:admin});assert.ok(Number.isInteger(stats.payload.insufficient));assert.ok(stats.payload.answered>0);
});
await check("postgres-job-summary-and-indexing-data",async()=>{
 const summary=await call("/api/app/admin/jobs-summary",{cookie:admin});assert.equal(summary.status,200);for(const key of ["queued","running","failed","completedToday"])assert.ok(Number.isInteger(summary.payload[key])&&summary.payload[key]>=0);
 const r=await call("/api/app/admin/jobs",{cookie:admin});assert.equal(r.status,200);assert.ok(r.payload.length>=8);assert.ok(r.payload.every(j=>Object.hasOwn(j,"active_revision")));
});
await check("postgres-audit-pagination-and-global-search",async()=>{
 const r=await call("/api/app/admin/audit?view=questions&page=1",{cookie:admin});assert.equal(r.status,200);assert.ok(r.payload.total>20);assert.equal(r.payload.traces.length,20);
 const second=await call("/api/app/admin/audit?view=questions&page=2",{cookie:admin});assert.equal(second.status,200);assert.ok(!second.payload.traces.some(t=>r.payload.traces.some(x=>x.id===t.id)));
 const trace=await call(`/api/app/admin/audit?view=questions&q=${tuitionMessage.trace_id}`,{cookie:admin});assert.equal(trace.payload.total,1);
 const events=await call("/api/app/admin/audit?view=events",{cookie:admin});assert.equal(events.status,200);assert.ok(events.payload.events.some(e=>e.actor_name));
});
await check("nine-review-faqs-and-live-source-links",async()=>{
 const r=await call("/api/app/faqs",{cookie});assert.equal(r.status,200);
 for(const topic of academicTopics)for(const question of topic.questions){const f=r.payload.find(f=>f.question===question);assert.ok(f,question);assert.equal(f.topic,topic.label);const source=await call(`/api/app/faq-source/${f.id}`,{cookie});assert.equal(source.status,200);assert.ok(source.payload.citation.quote.length>15);assert.ok(source.payload.pages.length>0);sourceFaqs.push(f);}
 const fee=sourceFaqs.find(f=>f.topic==="Học phí");assert.match(fee.answer,/CMU/);assert.match(fee.answer,/2026[–-]2027/);
 return {reviewFaqs:sourceFaqs.length};
});
await check("original-private-pdf-from-faq",async()=>{
 const fee=sourceFaqs.find(f=>f.topic==="Học phí"),r=await call(`/api/app/faq-source/${fee.id}/file`,{cookie});assert.equal(r.status,200);assert.match(r.response.headers.get("content-type"),/application\/pdf/);const bytes=Buffer.from(await r.response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),"%PDF-");assert.equal((await call(`/api/app/faq-source/${fee.id}/file`)).status,401);return {pdfBytes:bytes.length};
});
await check("source-less-draft-is-safe-and-not-published",async()=>{
 const question=`QC draft only ${randomUUID()}`,r=await call("/api/app/admin/faqs",{cookie:admin,method:"POST",body:{question,answer:"Nội dung tổng hợp chỉ để kiểm thử, không dùng làm thông tin học vụ.",topic:"Thủ tục",status:"draft"}});assert.equal(r.status,200);const id=r.payload.id;
 assert.equal((await call(`/api/app/faq-source/${id}`,{cookie})).status,404);
 const invalid=await call("/api/app/admin/faqs",{cookie:admin,method:"POST",body:{id,question,answer:"Không được xuất bản nội dung thiếu nguồn.",topic:"Thủ tục",status:"published"}});assert.equal(invalid.status,400);
 assert.equal((await call(`/api/app/admin/faqs/${id}`,{cookie:admin,method:"DELETE"})).status,200);
});
await check("admin-pages-and-original-corpus-retained",async()=>{
 for(const path of ["/quan-tri","/quan-tri/thong-ke","/quan-tri/tai-lieu","/quan-tri/xu-ly-tai-lieu","/quan-tri/faq","/quan-tri/phan-hoi","/quan-tri/nhat-ky","/quan-tri/cai-dat"]){const r=await call(path,{cookie:admin});assert.equal(r.status,200,path);}
 const stats=await call("/api/app/admin/stats",{cookie:admin});assert.equal(stats.payload.published,baseline.published);assert.equal(stats.payload.chunks,baseline.chunks);return baseline;
});
console.log(JSON.stringify({passed:results.length,total:results.length,origin}));

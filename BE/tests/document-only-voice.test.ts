import test from "node:test";
import assert from "node:assert/strict";
import { answerFromDocuments } from "../rag/document-only";
import type { Answer } from "../rag/answer";
import type { Evidence } from "../rag/retrieve";

const fallback = (reason: string): Answer => ({status:"insufficient",content:"Chưa tìm thấy tài liệu.",citations:[],retrieval:[],reason,webStatus:"not_requested"});
const doc = {id:"S1",documentId:"doc",revisionId:"r1"} as Evidence;
const web = {id:"W1",documentId:"web",revisionId:"web"} as Evidence;
const answer = (documentId: string): Answer => ({...fallback("test"),status:"answered",content:"Nội dung [1]",citations:[{id:"1",documentId,chunkId:"c",revisionId:"r",title:"Nguồn",version:1,page:1,pageEnd:1,section:"",quote:"Trích",scope:""}]});

test("chế độ giọng nói loại nguồn web trước khi tạo câu trả lời", async () => {
  let seen: Evidence[] = [];
  const result = await answerFromDocuments("học phí", {faq:async()=>null,resolve:async()=>"học phí K29",retrieve:async(q)=>{assert.equal(q,"học phí K29");return [doc,web];},ground:async(_q,e)=>{seen=e;return answer("doc");},fallback});
  assert.deepEqual(seen,[doc]); assert.equal(result.status,"answered");
});
test("không có tài liệu thì fallback; không gọi mô hình trả lời", async () => {
  let called = false;
  const result = await answerFromDocuments("câu hỏi",{faq:async()=>null,resolve:async(q)=>q,retrieve:async()=>[web],ground:async()=>{called=true;return answer("web");},fallback});
  assert.equal(result.reason,"no_document_evidence"); assert.equal(called,false);
});
test("không chấp nhận câu trả lời không có citation tài liệu", async () => {
  const deps={faq:async()=>null,resolve:async(q:string)=>q,retrieve:async()=>[doc],ground:async()=>answer("web"),fallback};
  assert.equal((await answerFromDocuments("hỏi",deps)).reason,"invalid_document_citation");
  assert.equal((await answerFromDocuments("hỏi",{...deps,ground:async()=>({...answer("doc"),citations:[]})})).reason,"invalid_document_citation");
});

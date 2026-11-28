import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { Agent } from "@mastra/core/agent";
import { academicModel } from "../rag/model";

test("provider chính lỗi 429 thì chuyển sang Xkiro", async () => {
  let primary=0, fallback=0;
  const main=createServer((_req,res)=>{primary++;res.writeHead(429,{"content-type":"application/json"});res.end(JSON.stringify({error:{message:"quota",type:"rate_limit_error"}}));});
  const second=createServer((_req,res)=>{fallback++;res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({id:"test",object:"chat.completion",created:1,model:"test",choices:[{index:0,message:{role:"assistant",content:"Đã dùng nguồn dự phòng."},finish_reason:"stop"}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));});
  main.listen(0,"127.0.0.1");second.listen(0,"127.0.0.1");await Promise.all([once(main,"listening"),once(second,"listening")]);
  const keys=["AI_PRIMARY_PROVIDER","SAVEGATE_API_KEY","SAVEGATE_BASE_URL","XKIRO_API_KEY","XKIRO_BASE_URL"] as const;
  const saved=keys.map(k=>process.env[k]);
  try {
    process.env.AI_PRIMARY_PROVIDER="savegate";process.env.SAVEGATE_API_KEY="test";process.env.XKIRO_API_KEY="test";
    process.env.SAVEGATE_BASE_URL=`http://127.0.0.1:${(main.address() as {port:number}).port}/v1`;
    process.env.XKIRO_BASE_URL=`http://127.0.0.1:${(second.address() as {port:number}).port}/v1`;
    const agent=new Agent({id:"provider-fallback-test",name:"test",instructions:"Trả lời ngắn.",model:academicModel()});
    const result=await agent.generate("Xin chào");
    assert.equal(result.text,"Đã dùng nguồn dự phòng.");assert.ok(primary >= 1);assert.equal(fallback,1);
  } finally {
    keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});
    main.closeAllConnections();second.closeAllConnections();await Promise.all([new Promise<void>(r=>main.close(()=>r())),new Promise<void>(r=>second.close(()=>r()))]);
  }
});



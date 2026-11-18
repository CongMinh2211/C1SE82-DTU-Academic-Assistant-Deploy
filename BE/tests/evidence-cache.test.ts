import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceCache } from "../rag/evidence-cache";

test("cache tái sử dụng đồng thời, không chia sẻ đối tượng và hết hạn",async()=>{
 const cache=new EvidenceCache<{text:string}>(2,40);let calls=0;
 const calculate=async()=>{calls++;return {text:"nguồn"};};
 // Hai yêu cầu đồng thời cùng chờ một lần tính; sau đó sửa a để kiểm tra b là bản sao độc lập.
 const [a,b]=await Promise.all([cache.get("hỏi",["v1"],calculate),cache.get("hỏi",["v1"],calculate)]);
 a.text="sửa";assert.equal(b.text,"nguồn");assert.equal(calls,1);
 // Sau TTL, kết quả cũ hết hạn và lần đọc tiếp theo phải gọi hàm tính lại.
 await new Promise(r=>setTimeout(r,55));await cache.get("hỏi",["v1"],calculate);assert.equal(calls,2);
});
test("đổi phiên bản hoặc thông tin hiệu lực phải tìm lại; lỗi không được cache",async()=>{
 const cache=new EvidenceCache<number>();let calls=0;const calc=async()=>++calls;
 assert.equal(await cache.get("hỏi",["v1","2026-01-01"],calc),1);
 assert.equal(await cache.get("hỏi",["v2","2026-01-01"],calc),2);
 // Ngày hiệu lực thay đổi cũng phải làm mất hiệu lực kết quả trước đó.
 assert.equal(await cache.get("hỏi",["v2","2027-01-01"],calc),3);
 // Lỗi không được giữ trong cache: cùng khóa phải có thể tính thành công ở lần sau.
 await assert.rejects(cache.get("lỗi",[1],async()=>{throw new Error("fail");}));
 assert.equal(await cache.get("lỗi",[1],calc),4);
});

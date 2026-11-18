import assert from "node:assert/strict";
import {searchUniversityWeb} from "../BE/web-search";
import {writeFile} from "node:fs/promises";
const original = process.env.WEB_SEARCH_URL;
try {
  // Only this disposable evaluation process receives a deliberately unavailable
  // endpoint. The running search service and production configuration stay live.
  process.env.WEB_SEARCH_URL = "http://127.0.0.1:9";
  const result = await searchUniversityWeb("Chương trình Sinh viên Ưu tú có chính sách học phí gì?",undefined,["chương trình Sinh viên Ưu tú","học phí"]);
  assert.equal(result.coverage,"university_only");
  assert.ok(result.sources.some(s=>s.official));
  assert.ok(result.sources.every(s=>s.text.length>120 && s.url && s.retrievedAt));
  await writeFile("test-results/web-resilience.json",JSON.stringify({at:new Date().toISOString(),passed:true,coverage:result.coverage,sources:result.sources.map(s=>({url:s.url,discoveredBy:s.discoveredBy,characters:s.text.length}))},null,2));
  console.log(JSON.stringify({passed:true,coverage:result.coverage,sources:result.sources.length}));
}finally {if(original) process.env.WEB_SEARCH_URL=original;else delete process.env.WEB_SEARCH_URL;}

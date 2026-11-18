// Đo riêng tầng truy xuất RAG với đúng adapter PgVector và vector E5 của gói bàn giao.
// Database qa_rag nằm trong container thử riêng; không nhận DATABASE_URL từ môi trường.
import { PgVector } from "@mastra/pg";
import { Pool } from "pg";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const connectionString = "postgresql://qa:qa-local-only@dtu-qa-pgvector:5432/qa_rag";
const pool = new Pool({ connectionString, max: 2 });
const store = new PgVector({ id: "isolated-qa", connectionString, max: 10 });
const indexName = "qa_e5_384";
type Entry = { vector_id: string; embedding: string; metadata: { revisionId: string; documentId: string; page: number } };
const entries: Entry[] = JSON.parse(await readFile("seed/database/academic_e5_v1.json", "utf8"));
const documents: { active_revision: string | null; deleted_at: string | null }[] = JSON.parse(await readFile("seed/database/documents.json", "utf8"));
const active = documents.filter(d => !d.deleted_at && d.active_revision).map(d => d.active_revision!);
const candidates = entries.filter(e => active.includes(e.metadata.revisionId));
const queryVectors = candidates.slice(0, 12).map(e => JSON.parse(e.embedding) as number[]);
const batches = [];
try {
  await store.createIndex({ indexName, dimension: 384, metric: "cosine", indexConfig: { type: "hnsw" }, metadataIndexes: ["revisionId"] });
  // Các bản sao chỉ mô phỏng tăng kích thước chỉ mục; không coi là tài liệu khác nhau về nội dung.
  for (let copy = 0; copy < 20; copy++) {
    for (let offset = 0; offset < entries.length; offset += 250) {
      const part = entries.slice(offset, offset + 250);
      await store.upsert({ indexName, ids: part.map(e => `${e.vector_id}-${copy}`), vectors: part.map(e => JSON.parse(e.embedding)), metadata: part.map(e => ({ ...e.metadata, sourceChunkId: e.vector_id, copy })) });
    }
  }
  const before = await store.describeIndex({ indexName });
  // Nạp lại ID cũ phải cập nhật hàng cũ, không tăng số lượng vector.
  await store.upsert({ indexName, ids: entries.slice(0, 100).map(e => `${e.vector_id}-0`), vectors: entries.slice(0,100).map(e => JSON.parse(e.embedding)), metadata: entries.slice(0,100).map(e => ({ ...e.metadata, sourceChunkId: e.vector_id, copy: 0 })) });
  const after = await store.describeIndex({ indexName });
  assert.equal(after.count, before.count);
  const query = (n: number) => store.query({ indexName, queryVector: queryVectors[n % queryVectors.length], topK: 10, filter: { revisionId: { $in: active } }, ef: 100 });
  // Kiểm tra truy xuất và bộ lọc trước khi đo, tránh báo nhanh vì trả về rỗng hoặc nguồn sai.
  for (let i=0;i<queryVectors.length;i++) {
    const found = await query(i);
    assert.ok(found.length);
    assert.ok(found[0].score > .99, "Vector tự truy vấn phải tìm được bản sao cùng nội dung");
    assert.ok(found.every(item => active.includes(String(item.metadata?.revisionId))));
  }
  for (const concurrency of [1, 5, 10, 20]) {
    let next = 0, errors = 0;
    const timings: number[] = [];
    const started = performance.now();
    await Promise.all(Array.from({length:concurrency}, async () => {
      while (true) {
        const n = next++;
        if(n>=200) break;
        const before = performance.now();
        try { const found=await query(n); assert.ok(found.length); assert.ok(found.every(item => active.includes(String(item.metadata?.revisionId)))); }
        catch { errors++; }
        timings.push(performance.now()-before);
      }
    }));
    timings.sort((a,b)=>a-b);
    batches.push({concurrency, requests:200,errors,p50:timings[99],p95:timings[189],durationMs:performance.now()-started});
  }
  const version = await pool.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
  await mkdir("test-results",{recursive:true});
  const report={at:new Date().toISOString(),scope:"RAG vector retrieval only; not embedding/LLM/HTTP or real unique-document growth",vectorDimension:384,sourceVectors:entries.length,replicas:20,index:after,pgvector:version.rows[0],duplicateUpsertStable:true,activeRevisionFilterPassed:true,queries:"12 existing document vectors as self-query; not student paraphrase quality evaluation",batches};
  await writeFile("test-results/pgvector-load.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  assert.ok(batches.every(b=>b.errors===0));
} finally {
  await pool.end();
  await store.disconnect();
}

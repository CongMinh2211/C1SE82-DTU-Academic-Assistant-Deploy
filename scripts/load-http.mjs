// Đo API trên localhost; không ghi dữ liệu hoặc gửi câu hỏi tới nhà cung cấp AI.
import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
const origin = new URL(process.argv[2] || "http://127.0.0.1:3000");
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) throw new Error("Chỉ đo trên môi trường local.");
const concurrency = Number(process.argv[3] || 10);
const count = Number(process.argv[4] || 100);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50 || !Number.isInteger(count) || count < concurrency || count > 2000) throw new Error("Concurrency 1–50, tổng lượt không quá 2000.");
let next = 0;
const measurements = [];
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next++ < count) {
    const before = performance.now();
    try {
      const response = await fetch(new URL("/api/public/auth-config", origin), { signal: AbortSignal.timeout(15000) });
      await response.arrayBuffer();
      measurements.push({ milliseconds: performance.now() - before, status: response.status });
    } catch { measurements.push({ milliseconds: performance.now() - before, status: 0 }); }
  }
}));
const sorted = measurements.map(item => item.milliseconds).sort((a,b) => a-b);
const report = { at: new Date().toISOString(), scope: "HTTP proxy và cấu hình công khai; không đo AI, CSDL hoặc pgvector", count, concurrency, errors: measurements.filter(item => item.status !== 200).length, durationMs: performance.now()-started, p50: sorted[Math.ceil(count*.5)-1], p95: sorted[Math.ceil(count*.95)-1] };
await mkdir("test-results", { recursive: true });
await writeFile("test-results/load-http.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.errors) process.exitCode = 1;

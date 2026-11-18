// Đo tìm kiếm lịch sử với dữ liệu tổng hợp trong CSDL tạm; không dùng dữ liệu sinh viên thật.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

if (process.env.DATABASE_URL) throw new Error("Không đo tải trên CSDL cloud.");
const directory = await mkdtemp(path.join(tmpdir(), "dtu-history-load-"));
process.env.APP_DATA_DIR = directory;
const { db } = await import("../BE/db");
const { historyPage } = await import("../BE/conversations");
try {
  // Hai tài khoản giả để phép đo kiểm tra luôn phạm vi dữ liệu theo chủ sở hữu.
  await db().transaction(async () => {
    for (let i = 0; i < 10000; i++) {
      const id = `test-${i}`, owner = i % 2 ? "student-a" : "student-b";
      await db().prepare("INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?)").run(id, owner, `Hội thoại học phí mẫu ${i}`, "2026-01-01", "2026-01-01");
      await db().prepare("INSERT INTO messages(id,conversation_id,role,content,status,created_at) VALUES(?,?,?,?,?,?)").run(`msg-${i}`, id, "user", `Câu hỏi học vụ tổng hợp ${i}`, "saved", "2026-01-01");
    }
  })();
  const durations: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const result = await historyPage("student-a", false, i % 2 ? "học phí" : "", 1);
    durations.push(performance.now() - start);
    if (result.total !== 5000 || result.items.some((item) => Number(item.id.slice(5)) % 2 !== 1)) throw new Error("Kết quả phân trang hoặc quyền sở hữu không đúng.");
  }
  durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ dataset: 10000, requests: durations.length, p50Ms: Math.round(durations[9]), p95Ms: Math.round(durations[18]), maxMs: Math.round(durations[19]), scope: "SQLite history search only" }));
} finally { await db().close(); await rm(directory, { recursive: true, force: true }); }

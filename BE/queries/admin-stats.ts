// Mục đích file: Tính thống kê tổng quan từ dữ liệu quản trị thay vì dùng số liệu minh họa.
import { row, rows } from "../db";
import { webSearchState } from "../web-search";

// Mỗi truy vấn đếm một chỉ số; chỉ nguồn và đoạn đang hoạt động được tính vào kho phục vụ.
export const dashboardCountQueries = {
  users: "SELECT count(*) n FROM user",
  documents: "SELECT count(*) n FROM documents WHERE deleted_at IS NULL",
  published:
    "SELECT count(*) n FROM documents WHERE deleted_at IS NULL AND active_revision IS NOT NULL",
  questions: "SELECT count(*) n FROM traces",
  answered:
    "SELECT count(*) n FROM traces t WHERE t.status='answered' AND EXISTS (SELECT 1 FROM messages m WHERE m.trace_id=t.id AND m.role='assistant' AND m.citations_json NOT IN ('[]','null',''))",
  insufficient: "SELECT count(*) n FROM traces WHERE status='insufficient'",
  pendingDocuments:
    "SELECT count(*) n FROM documents d JOIN revisions r ON r.document_id=d.id WHERE d.deleted_at IS NULL AND r.status='ready' AND r.id<>COALESCE(d.active_revision,'') AND r.version=(SELECT max(version) FROM revisions WHERE document_id=d.id)",
  unanswered:
    "SELECT count(*) n FROM traces WHERE status IN ('insufficient','clarification','error')",
  feedback: "SELECT count(*) n FROM feedback WHERE status='pending'",
  chunks:
    "SELECT count(*) n FROM chunks c JOIN documents d ON d.active_revision=c.revision_id WHERE d.deleted_at IS NULL",
} as const;
export type DashboardCounts = Record<
  keyof typeof dashboardCountQueries,
  number
>;

// Gộp các phép đếm thành một câu truy vấn để đọc số liệu cùng thời điểm.
const countersSql =
  "SELECT " +
  Object.entries(dashboardCountQueries)
    .map(
      ([key, sql]) =>
        `(${sql.replace(/count\(\*\) n/i, "count(*)")}) AS "${key}"`,
    )
    .join(",");

export async function dashboardCounters(read = row<DashboardCounts>) {
  const result = await read(countersSql);
  if (!result) throw new Error("Missing dashboard counters");
  return result;
}

export async function dashboardStats() {
  // Đọc đồng thời số liệu, câu hỏi gần đây và trạng thái vận hành độc lập.
  const [counts, recent, worker, webSearch] = await Promise.all([
    dashboardCounters(),
    rows(
      "SELECT question,status,reason,created_at FROM traces ORDER BY created_at DESC LIMIT 8",
    ),
    process.env.INDEXING_MODE === "vercel_queue"
      ? Promise.resolve(true)
      : row(
          "SELECT key FROM rate_limits WHERE key='worker:heartbeat' AND expires_at>?",
          Date.now(),
        ).then(Boolean),
    webSearchState(),
  ]);
  return { ...counts, webSearch, workerAlive: worker, recent };
}

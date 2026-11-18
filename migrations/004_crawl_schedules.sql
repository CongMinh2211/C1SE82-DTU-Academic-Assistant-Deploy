-- Lịch thu thập nền, không tự xuất bản dữ liệu sau khi tải.
CREATE TABLE IF NOT EXISTS crawl_schedules (
 id TEXT PRIMARY KEY, start_url TEXT NOT NULL, topic TEXT NOT NULL, scope TEXT NOT NULL,
 interval_hours INTEGER NOT NULL, max_pages INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, next_run BIGINT NOT NULL, lease_until BIGINT, last_run BIGINT,
 last_status TEXT, last_message TEXT, created_at TEXT NOT NULL
);

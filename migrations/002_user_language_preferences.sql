-- Áp dụng một lần cho PostgreSQL đã có dữ liệu; không xóa hoặc thay đổi tài khoản.
CREATE TABLE IF NOT EXISTS user_language_preferences (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 ui_language TEXT NOT NULL DEFAULT 'vi' CHECK(ui_language IN ('vi','en','hi')),
 answer_language TEXT NOT NULL DEFAULT 'auto' CHECK(answer_language IN ('auto','vi','en','hi')),
 updated_at TEXT NOT NULL
);

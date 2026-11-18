-- PostgreSQL: cài đặt theo tài khoản và hàng đợi email; không sửa dữ liệu hiện có.
CREATE TABLE IF NOT EXISTS user_notification_preferences (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 feedback_email INTEGER NOT NULL DEFAULT 0 CHECK(feedback_email IN (0,1)),
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback_email_queue (
 feedback_id TEXT PRIMARY KEY REFERENCES feedback(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 next_attempt_at BIGINT NOT NULL, lease_until BIGINT, claim_token TEXT,
 created_at TEXT NOT NULL, sent_at TEXT
);
CREATE INDEX IF NOT EXISTS feedback_email_due ON feedback_email_queue(status,next_attempt_at);

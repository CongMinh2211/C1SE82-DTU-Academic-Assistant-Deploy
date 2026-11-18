-- Lưu bản chụp hội thoại được chia sẻ, mã thông báo đã băm và thời hạn truy cập; bản chụp không tự cập nhật.
CREATE TABLE IF NOT EXISTS shared_conversations (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  snapshot_json TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);

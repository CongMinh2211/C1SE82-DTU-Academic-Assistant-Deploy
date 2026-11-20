// Mục đích file: Khởi tạo CSDL SQLite local, bảng dữ liệu và các chỉ mục cần thiết; giữ kết nối dùng chung.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dataDir, databasePath } from "./config";

const globalDb = globalThis as unknown as { academicDb?: Database.Database };
export function db() {
  // Tái sử dụng kết nối đã mở; nếu chưa có thì tạo thư mục dữ liệu và CSDL local.
  if (globalDb.academicDb) return globalDb.academicDb;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const connection = new Database(databasePath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 10000");
  // Đăng ký hàm tìm kiếm không dấu dùng trong truy vấn lịch sử.
  connection.function(
    "search_fold",
    { deterministic: true },
    (value: unknown) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase(),
  );
  // Tạo bảng và chỉ mục nếu chưa tồn tại; không xóa dữ liệu hiện có.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS "user" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "emailVerified" INTEGER NOT NULL DEFAULT 0, "image" TEXT, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, "role" TEXT DEFAULT 'user', "banned" INTEGER DEFAULT 0, "banReason" TEXT, "banExpires" TEXT, "studentCode" TEXT, "cohort" TEXT, "major" TEXT);
    CREATE TABLE IF NOT EXISTS "session" ("id" TEXT PRIMARY KEY, "expiresAt" TEXT NOT NULL, "token" TEXT NOT NULL UNIQUE, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, "impersonatedBy" TEXT);
    CREATE TABLE IF NOT EXISTS "account" ("id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TEXT, "refreshTokenExpiresAt" TEXT, "scope" TEXT, "password" TEXT, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS "verification" ("id" TEXT PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TEXT NOT NULL, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS "rateLimit" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "count" INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL);

    -- Lưu ngôn ngữ theo tài khoản, không phụ thuộc trình duyệt hoặc thiết bị.
    CREATE TABLE IF NOT EXISTS user_language_preferences (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      ui_language TEXT NOT NULL DEFAULT 'vi' CHECK(ui_language IN ('vi','en','hi')),
      answer_language TEXT NOT NULL DEFAULT 'auto' CHECK(answer_language IN ('auto','vi','en','hi')),
      updated_at TEXT NOT NULL
    );
    -- Chỉ gửi email phản hồi sau khi chủ tài khoản chủ động bật nhận.
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      feedback_email INTEGER NOT NULL DEFAULT 0 CHECK(feedback_email IN (0,1)),
      updated_at TEXT NOT NULL
    );
    -- Hàng đợi bền vững; mỗi góp ý chỉ có một thông báo khi được xử lý.
    CREATE TABLE IF NOT EXISTS feedback_email_queue (
      feedback_id TEXT PRIMARY KEY REFERENCES feedback(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
      next_attempt_at BIGINT NOT NULL, lease_until BIGINT, claim_token TEXT,
      created_at TEXT NOT NULL, sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS feedback_email_due ON feedback_email_queue(status,next_attempt_at);
    -- Cấu hình đợt thu thập nguồn DTU chạy nền; tài liệu luôn chờ duyệt.
    CREATE TABLE IF NOT EXISTS crawl_schedules (
      id TEXT PRIMARY KEY, start_url TEXT NOT NULL, topic TEXT NOT NULL, scope TEXT NOT NULL,
      interval_hours INTEGER NOT NULL, max_pages INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL, next_run BIGINT NOT NULL, lease_until BIGINT, last_run BIGINT,
      last_status TEXT, last_message TEXT, created_at TEXT NOT NULL
    );
    -- Lưu thông tin chung của tài liệu, nguồn, phạm vi áp dụng và phiên bản đang công bố; deleted_at đánh dấu xóa mềm.
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, topic TEXT NOT NULL,
      source_kind TEXT NOT NULL, source_url TEXT, original_name TEXT,
      scope TEXT NOT NULL DEFAULT '', active_revision TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    -- Lưu từng phiên bản tài liệu, mã kiểm tra nội dung, đường dẫn tệp, trạng thái xử lý và thời điểm công bố.
    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
      version INTEGER NOT NULL, sha256 TEXT NOT NULL, raw_path TEXT NOT NULL,
      mime TEXT NOT NULL, title_snapshot TEXT NOT NULL, scope_snapshot TEXT NOT NULL, source_url TEXT, status TEXT NOT NULL DEFAULT 'queued',
      pages_json TEXT, chunk_count INTEGER DEFAULT 0, error TEXT,
      created_at TEXT NOT NULL, published_at TEXT,
      UNIQUE(document_id, version)
    );
    -- Lưu các đoạn nội dung trích từ tài liệu kèm trang và mục để tìm kiếm, tạo câu trả lời và trích dẫn nguồn.
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES revisions(id),
      document_id TEXT NOT NULL REFERENCES documents(id), page INTEGER NOT NULL,
      page_end INTEGER NOT NULL, section TEXT NOT NULL, text TEXT NOT NULL,
      search_text TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chunks_revision ON chunks(revision_id);
    -- Lưu chỉ mục tìm kiếm toàn văn cho nội dung đoạn tài liệu; cấu trúc SQLite và PostgreSQL khác nhau.
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(id UNINDEXED, text, tokenize='unicode61 remove_diacritics 2');
    -- Theo dõi công việc xử lý phiên bản tài liệu: trạng thái, tiến độ, số lần thử, lỗi và thời gian thực hiện.
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES revisions(id),
      status TEXT NOT NULL DEFAULT 'queued', stage TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT, lease_until INTEGER, started_at TEXT, finished_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_live_job ON jobs(revision_id) WHERE status IN ('queued','running');
    -- Lưu hội thoại của từng người dùng, tiêu đề, thời gian cập nhật và thời điểm chuyển vào thùng rác nếu có.
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS conversation_owner ON conversations(user_id,updated_at);
    -- Lưu các lượt hỏi và trả lời trong hội thoại cùng trạng thái, nguồn trích dẫn và mã truy vết; xóa hội thoại sẽ xóa các lượt tương ứng.
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]', trace_id TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS message_conversation ON messages(conversation_id,created_at);
    -- Lưu bản chụp hội thoại được chia sẻ, mã thông báo đã băm và thời hạn truy cập; bản chụp không tự cập nhật.
    CREATE TABLE IF NOT EXISTS shared_conversations (
      conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      snapshot_json TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    -- Lưu đánh giá, góp ý của người dùng và tình trạng xử lý; nếu tin nhắn nguồn bị xóa thì liên kết tin nhắn được để trống.
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', resolution TEXT, resolved_by TEXT,
      created_at TEXT NOT NULL, resolved_at TEXT
    );
    -- Lưu câu hỏi thường gặp, câu trả lời, chủ đề, đoạn nguồn và trạng thái biên soạn hoặc công bố.
    CREATE TABLE IF NOT EXISTS faqs (
      id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL,
      topic TEXT NOT NULL, source_chunk TEXT REFERENCES chunks(id),
      status TEXT NOT NULL DEFAULT 'draft', updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    -- Ghi nhật ký thao tác: người thực hiện, hành động, đối tượng liên quan, chi tiết và thời gian.
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_id TEXT,
      detail TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_time ON audit(created_at);
    -- Ghi nhận câu hỏi, kết quả truy xuất, model, thời gian xử lý và lý do để kiểm tra chất lượng trả lời.
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
      question TEXT NOT NULL, status TEXT NOT NULL, retrieval_json TEXT NOT NULL DEFAULT '[]',
      model TEXT, latency_ms INTEGER, reason TEXT, created_at TEXT NOT NULL
    );
    -- Lưu bộ đếm và thời điểm hết hạn để giới hạn tần suất sử dụng theo từng khóa.
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    -- Lưu khóa phiên xử lý chat và hạn khóa theo người dùng để điều phối yêu cầu đồng thời.
    CREATE TABLE IF NOT EXISTS chat_leases (user_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  `);
  // Nâng cấp CSDL local cũ: bổ sung nguồn cho phiên bản và sao chép URL từ tài liệu cha nếu thiếu.
  const revisionColumns = connection
    .prepare("PRAGMA table_info(revisions)")
    .all() as { name: string }[];
  if (!revisionColumns.some((c) => c.name === "source_url")) {
    connection.exec("ALTER TABLE revisions ADD COLUMN source_url TEXT");
    connection.exec(
      "UPDATE revisions SET source_url=(SELECT source_url FROM documents WHERE documents.id=revisions.document_id)",
    );
  }
  // Không tự gán ngày cho nguồn cũ: giá trị NULL nghĩa là chưa xác minh.
  for (const column of ["issued_on", "effective_from", "effective_until", "scope_key"]) {
    if (!revisionColumns.some((c) => c.name === column))
      connection.exec(`ALTER TABLE revisions ADD COLUMN ${column} TEXT`);
  }
  // Bổ sung thời điểm xóa mềm để hỗ trợ thùng rác mà không xóa ngay hội thoại.
  const conversationColumns = connection
    .prepare("PRAGMA table_info(conversations)")
    .all() as { name: string }[];
  if (!conversationColumns.some((c) => c.name === "deleted_at"))
    connection.exec("ALTER TABLE conversations ADD COLUMN deleted_at TEXT");
  globalDb.academicDb = connection;
  return connection;
}
export function rows<T>(sql: string, ...params: (string | number | null)[]) {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}
export function row<T>(sql: string, ...params: (string | number | null)[]) {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function audit(
  actor: string | null,
  action: string,
  entity: string | null,
  detail: object = {},
) {
  db()
    .prepare("INSERT INTO audit VALUES (?,?,?,?,?,?)")
    .run(id(), actor, action, entity, JSON.stringify(detail), now());
}

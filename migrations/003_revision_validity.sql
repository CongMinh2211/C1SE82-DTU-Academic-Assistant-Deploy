-- Các nguồn cũ giữ giá trị NULL cho tới khi quản trị viên đối chiếu nguồn gốc.
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS issued_on TEXT;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS effective_from TEXT;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS effective_until TEXT;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS scope_key TEXT;

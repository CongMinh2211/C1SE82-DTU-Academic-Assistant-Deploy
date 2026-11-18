// Kiểm tra Admin tìm và phân trang được cả tài khoản đăng nhập Google.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = await mkdtemp(path.join(tmpdir(), "dtu-admin-users-"));
process.env.APP_DATA_DIR = directory;
const { db } = await import("../../BE/db");
const { adminUsersPage } = await import("../../BE/queries/admin-users");
const connection = db();
// Tạo bảng xác thực tối thiểu trong database tạm, tuyệt đối không dùng dữ liệu thật.
await connection.prepare("CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, banned INTEGER, createdAt TEXT, studentCode TEXT, cohort TEXT, major TEXT)").run();
await connection.prepare("CREATE TABLE account (userId TEXT, providerId TEXT)").run();
for (let i = 0; i < 205; i++) {
  await connection.prepare("INSERT INTO user(id,name,email,role,banned,createdAt) VALUES(?,?,?,?,?,?)").run(`u${i}`, `Sinh viên ${i}`, `user${i}@example.test`, "user", 0, String(i).padStart(3, "0"));
}
await connection.prepare("INSERT INTO account(userId,providerId) VALUES(?,?)").run("u0", "google");
test("tài khoản Google cũ vẫn tìm được và không trả bí mật", async () => {
  const first = await adminUsersPage(new URLSearchParams());
  assert.equal(first.total, 205);
  assert.equal(first.items.length, 20);
  const found = await adminUsersPage(new URLSearchParams({ q: "user0@example.test", page: "99" }));
  assert.equal(found.page, 1);
  assert.equal(found.items.length, 1);
  assert.equal((found.items[0] as { google_linked: number }).google_linked, 1);
  assert.equal("accessToken" in (found.items[0] as object), false);
  assert.equal((await adminUsersPage(new URLSearchParams({ q: "%" }))).total, 0);
});
test.after(async () => {
  // Đóng kết nối trước khi xóa CSDL tạm, tránh Windows giữ khóa file WAL.
  const { db: localDb } = await import("../../BE/sqlite");
  localDb().close();
  await rm(directory, { recursive: true, force: true });
});

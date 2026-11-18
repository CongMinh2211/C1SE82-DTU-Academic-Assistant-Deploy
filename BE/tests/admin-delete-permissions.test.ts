// Kiểm thử xóa tài khoản bằng phiên thật trên CSDL tạm; không dùng tài khoản người dùng.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMigrations } from "better-auth/db/migration";

const dir = await mkdtemp(path.join(tmpdir(), "dtu-admin-delete-test-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET = "test-secret-only-1234567890123456789012345";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.EMAIL_OTP_ENABLED = "false";
const { getAuth } = await import("../../BE/auth");
const { db, row } = await import("../../BE/db");
const { postResource } = await import("../../BE/api/post");
const auth = getAuth();
await (await getMigrations(auth.options)).runMigrations();
const password = "test-password-12345";
const admin = await auth.api.signUpEmail({ body: { name: "Admin test", email: "admin@example.test", password } });
await db().prepare("UPDATE user SET role='admin' WHERE id=?").run(admin.user.id);
const student = await auth.api.signUpEmail({ body: { name: "Student test", email: "student@example.test", password } });
async function cookie(email: string) {
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}
const adminCookie = await cookie("admin@example.test");
const studentCookie = await cookie("student@example.test");
function request(cookieValue: string, id: string) {
  return new Request(`http://localhost:3000/api/app/admin/users/${id}/delete`, { method: "POST", headers: { cookie: cookieValue, origin: "http://localhost:3000" } });
}
test("sinh viên không được gọi API xóa tài khoản", async () => {
  await assert.rejects(postResource(request(studentCookie, student.user.id)), (error: unknown) => (error as { status?: number }).status === 403);
});
test("không thể bỏ qua kiểm tra qua endpoint xóa trực tiếp Better Auth", async () => {
  const response = await auth.handler(new Request("http://localhost:3000/api/auth/admin/remove-user", { method: "POST", headers: { cookie: adminCookie, origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ userId: student.user.id }) }));
  assert.equal(response.status, 404);
});
test("admin không thể xóa tài khoản chưa bị khóa", async () => {
  await assert.rejects(postResource(request(adminCookie, student.user.id)), (error: unknown) => (error as { status?: number }).status === 409);
});
test("admin được xóa tài khoản đã khóa không có dữ liệu", async () => {
  await db().prepare("UPDATE user SET banned=1 WHERE id=?").run(student.user.id);
  assert.deepEqual(await postResource(request(adminCookie, student.user.id)), { ok: true });
  assert.equal(await row("SELECT id FROM user WHERE id=?", student.user.id), undefined);
});
test("không xóa tài khoản có lịch sử dù đã khóa", async () => {
  const owner = await auth.api.signUpEmail({ body: { name: "Owner test", email: "owner@example.test", password } });
  await db().prepare("UPDATE user SET banned=1 WHERE id=?").run(owner.user.id);
  await db().prepare("INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)").run("history", owner.user.id, "test", "2026-01-01", "2026-01-01");
  await assert.rejects(postResource(request(adminCookie, owner.user.id)), (error: unknown) => (error as { status?: number }).status === 409);
  assert.ok(await row("SELECT id FROM conversations WHERE id=?", "history"));
});
test.after(async () => { await db().close(); await rm(dir, { recursive: true, force: true }); });

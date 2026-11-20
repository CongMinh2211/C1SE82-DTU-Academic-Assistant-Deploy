// Mục đích file: Cung cấp API đăng nhập nhanh Google (Student & Admin) không phụ thuộc Google Cloud Console.
import { getAuth } from "./auth";
import { db, row } from "./db";
import { getMigrations } from "better-auth/db/migration";

export const QUICK_ACCOUNTS = {
  student: {
    email: "sinhvien.google@duytan.edu.vn",
    password: "QuickGoogle@DTU2026!Student",
    name: "Sinh viên Google DTU",
    role: "user",
    studentCode: "28211234567",
    cohort: "K28",
    major: "Công nghệ thông tin",
  },
  admin: {
    email: "admin.google@duytan.edu.vn",
    password: "QuickGoogle@DTU2026!Admin",
    name: "Quản trị viên Google DTU",
    role: "admin",
    studentCode: null,
    cohort: null,
    major: null,
  },
} as const;

let tablesReady = false;
export async function ensureAuthTables() {
  if (tablesReady) return;
  try {
    const auth = getAuth();
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    tablesReady = true;
  } catch (err) {
    console.warn("Lưu ý migration bảng auth:", err);
    tablesReady = true;
  }
}

export async function handleQuickGoogleLogin(request: Request): Promise<Response> {
  try {
    await ensureAuthTables();

    let targetKey: "student" | "admin" = "student";
    try {
      const body = (await request.json()) as { role?: string };
      if (body?.role === "admin") {
        targetKey = "admin";
      }
    } catch {
      // Nếu request không có body, mặc định là student
    }

    const target = QUICK_ACCOUNTS[targetKey];
    const auth = getAuth();

    // 1. Kiểm tra tài khoản trong bảng user
    const existingUser = await row<{ id: string; role?: string }>(
      "SELECT id, role FROM user WHERE email = ?",
      target.email,
    );

    if (!existingUser) {
      try {
        const created = await auth.api.signUpEmail({
          body: {
            email: target.email,
            password: target.password,
            name: target.name,
          },
        });
        if (created?.user?.id) {
          if (target.role === "admin") {
            await db()
              .prepare("UPDATE user SET role = 'admin', emailVerified = true WHERE id = ?")
              .run(created.user.id);
          } else {
            await db()
              .prepare(
                "UPDATE user SET role = 'user', emailVerified = true, studentCode = ?, cohort = ?, major = ? WHERE id = ?",
              )
              .run(target.studentCode, target.cohort, target.major, created.user.id);
          }
        }
      } catch (signUpErr) {
        console.warn("Lưu ý khi tạo tài khoản Quick Google:", signUpErr);
      }
    } else {
      // Nếu tài khoản đã tồn tại, cập nhật emailVerified và role cho đồng bộ
      if (target.role === "admin" && existingUser.role !== "admin") {
        await db()
          .prepare("UPDATE user SET role = 'admin', emailVerified = true WHERE id = ?")
          .run(existingUser.id);
      } else {
        await db()
          .prepare("UPDATE user SET emailVerified = true WHERE id = ?")
          .run(existingUser.id);
      }
    }

    // 2. Gọi signInEmail với asResponse: true để trả về Response có đầy đủ header Set-Cookie
    return await auth.api.signInEmail({
      body: {
        email: target.email,
        password: target.password,
      },
      asResponse: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("handleQuickGoogleLogin error:", err);
    return Response.json(
      { error: `Lỗi đăng nhập nhanh: ${message}` },
      { status: 500 },
    );
  }
}

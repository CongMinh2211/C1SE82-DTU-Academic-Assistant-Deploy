// Mục đích file: Cung cấp API đăng nhập nhanh Google (Student & Admin) không phụ thuộc Google Cloud Console.
import { getAuth } from "./auth";
import { db, row, id, now } from "./db";
import { hashPassword } from "@better-auth/utils/password";

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

export async function handleQuickGoogleLogin(request: Request): Promise<Response> {
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
    'SELECT id, role FROM "user" WHERE email = ?',
    target.email,
  );

  const passwordHash = await hashPassword(target.password);

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
            .prepare('UPDATE "user" SET role = \'admin\', "emailVerified" = 1 WHERE id = ?')
            .run(created.user.id);
        } else {
          await db()
            .prepare(
              'UPDATE "user" SET role = \'user\', "emailVerified" = 1, "studentCode" = ?, cohort = ?, major = ? WHERE id = ?',
            )
            .run(target.studentCode, target.cohort, target.major, created.user.id);
        }
      }
    } catch (signUpErr) {
      console.warn("Lưu ý khi tạo tài khoản Quick Google:", signUpErr);
    }
  } else {
    // Đảm bảo mật khẩu và quyền khớp
    const credAccount = await row<{ id: string }>(
      'SELECT id FROM "account" WHERE "userId" = ? AND "providerId" = \'credential\'',
      existingUser.id,
    );
    if (credAccount) {
      await db()
        .prepare('UPDATE "account" SET password = ? WHERE id = ?')
        .run(passwordHash, credAccount.id);
    } else {
      await db()
        .prepare(
          'INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(id(), existingUser.id, existingUser.id, "credential", passwordHash, now(), now());
    }

    if (target.role === "admin" && existingUser.role !== "admin") {
      await db()
        .prepare('UPDATE "user" SET role = \'admin\', "emailVerified" = 1 WHERE id = ?')
        .run(existingUser.id);
    } else {
      await db()
        .prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?')
        .run(existingUser.id);
    }
  }

  // 2. Chạy Better Auth sign-in chính thức để sinh session cookie hợp lệ
  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const signInUrl = new URL("/api/auth/sign-in/email", request.url);
  const signInHeaders = new Headers(request.headers);
  signInHeaders.set("content-type", "application/json");
  signInHeaders.set("origin", origin);

  const signInRequest = new Request(signInUrl, {
    method: "POST",
    headers: signInHeaders,
    body: JSON.stringify({
      email: target.email,
      password: target.password,
    }),
  });

  return auth.handler(signInRequest);
}

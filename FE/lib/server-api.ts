// Giao diện SSR gọi Backend qua HTTP; không mở CSDL hoặc đọc credential AI.
import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import type { getAuth } from "../../BE/auth";
import type { readConversationShare as readShare } from "../../BE/share";

const origin = () => process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8001";
async function read<T>(path: string, cookie = ""): Promise<T> {
  // Chỉ chuyển cookie sang địa chỉ Backend cấu hình ở server, không nhận đích từ người dùng.
  const response = await fetch(`${origin()}${path}`, { headers: { cookie }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Không thể tải dữ liệu từ Backend.");
  return response.json() as Promise<T>;
}
type Session = Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>;
export const pageSession = cache(async (): Promise<Session> => {
  try {
    const requestHeaders = await headers();
    return await read<Session>("/api/auth/get-session", requestHeaders.get("cookie") || "");
  } catch {
    // Tránh crash Next.js SSR khi Backend chưa sẵn sàng hoặc kết nối bị gián đoạn.
    return null as Session;
  }
});
export const publicAuthConfig = () => read<{ googleEnabled: boolean; otpEnabled: boolean }>("/api/public/auth-config");
export const readConversationShare = (token: string) => read<Awaited<ReturnType<typeof readShare>>>(`/api/public/shares/${encodeURIComponent(token)}`);

// Render dùng chứng chỉ tự ký trên mạng riêng. Chỉ bật chế độ này khi đã cấu hình
// tường minh cho bản demo và hostname khớp database nội bộ Render.
export function postgresConnectionUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Invalid PostgreSQL connection URL");
  }
  const renderInternal = process.env.RENDER_POSTGRES_INTERNAL === "true";
  if (renderInternal && !/^dpg-[a-z0-9]+-a(?:\.singapore-postgres\.render\.com)?$/i.test(url.hostname)) {
    throw new Error("Render internal PostgreSQL hostname required");
  }
  url.searchParams.set("sslmode", renderInternal ? "no-verify" : "verify-full");
  url.searchParams.delete("uselibpqcompat");
  return url.href;
}

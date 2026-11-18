// Backend HTTP độc lập: dùng lại handler nghiệp vụ và kiểm tra quyền tại máy chủ.
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { getAuth } from "./auth";
import { googleOAuthConfig } from "./google-config";
import { readConversationShare } from "./share";
import { endpoint } from "./http";

const port = Number(process.env.API_PORT || 8001);
const server = createServer(async (incoming, outgoing) => {
  // Hủy thao tác đang chạy khi client đóng kết nối, tránh tiếp tục dùng tài nguyên.
  const controller = new AbortController();
  outgoing.on("close", () => { if (!outgoing.writableEnded) controller.abort(); });
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
      else if (value !== undefined) headers.set(key, value);
    }
    const url = new URL(incoming.url || "/", process.env.BETTER_AUTH_URL || "http://localhost:3000");
    const method = incoming.method || "GET";
    // Chuyển luồng Node thành Web Request để giữ nguyên bộ giới hạn upload của handler.
    const request = new Request(url, { method, headers, signal: controller.signal, ...(!["GET", "HEAD"].includes(method) ? { body: Readable.toWeb(incoming), duplex: "half" } : {}) } as RequestInit);
    const response = await endpoint(async () => {
      if (url.pathname.startsWith("/api/auth/")) return getAuth().handler(request);
      if (url.pathname === "/api/public/auth-config") return { googleEnabled: !!googleOAuthConfig(), otpEnabled: process.env.EMAIL_OTP_ENABLED === "true" };
      if (url.pathname.startsWith("/api/public/shares/") && method === "GET") return Response.json(await readConversationShare(decodeURIComponent(url.pathname.slice(19))));
      let route: Record<string, unknown>;
      if (url.pathname.startsWith("/api/app/")) route = await import("./routes/app/[...resource]/route");
      else if (url.pathname === "/api/health") route = await import("./routes/health/route");
      else if (url.pathname === "/api/queues/index") route = await import("./routes/queues/index/route");
      else if (url.pathname === "/api/uploads") route = await import("./routes/uploads/route");
      else if (url.pathname === "/api/cron/purge-trash") route = await import("./routes/cron/purge-trash/route");
      else return Response.json({ error: "Không tìm thấy API." }, { status: 404 });
      const handler = route[method];
      return typeof handler === "function" ? handler(request) : Response.json({ error: "Phương thức không hỗ trợ." }, { status: 405 });
    })(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => { if (key !== "set-cookie") outgoing.setHeader(key, value); });
    // Giữ riêng từng Set-Cookie; ghép bằng dấu phẩy sẽ làm hỏng phiên đăng nhập.
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader("set-cookie", cookies);
    if (response.body) Readable.fromWeb(response.body as never).pipe(outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) { outgoing.statusCode = 500; outgoing.setHeader("content-type", "application/json"); }
    outgoing.end(JSON.stringify({ error: "Dịch vụ tạm thời không khả dụng." }));
  }
});
server.requestTimeout = 180000;
server.headersTimeout = 30000;
server.listen(port, process.env.API_HOST || "127.0.0.1", () => console.log(`Backend sẵn sàng tại cổng ${port}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());

// Cổng HTTP cùng tên miền giữ cookie; nghiệp vụ và phân quyền do Backend xử lý.
export const runtime = "nodejs";
async function proxy(request: Request) {
  const source = new URL(request.url);
  const target = new URL(source.pathname + source.search, process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8001");
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("accept-encoding", "identity");
  try {
    // Chuyển trực tiếp luồng upload, không đọc toàn bộ PDF vào bộ nhớ FE.
    const response = await fetch(target, { method: request.method, headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body, duplex: "half", redirect: "manual", signal: request.signal } as RequestInit);
    const forwardHeaders = new Headers(response.headers);
    const setCookies = response.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      forwardHeaders.delete("set-cookie");
      for (const cookie of setCookies) {
        forwardHeaders.append("set-cookie", cookie);
      }
    }
    return new Response(response.body, { status: response.status, headers: forwardHeaders });
  } catch {
    return Response.json({ error: "Backend tạm thời không khả dụng." }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as PUT, proxy as OPTIONS };

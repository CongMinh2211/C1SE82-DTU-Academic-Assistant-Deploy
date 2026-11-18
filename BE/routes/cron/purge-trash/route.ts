import { timingSafeEqual } from "node:crypto";
import { purgeExpiredConversations } from "@/server/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chỉ cron được cấu hình bí mật mới được xóa dữ liệu; không trả chi tiết hội thoại.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") || "";
  if (!secret || secret.length < 32)
    return new Response("Cron chưa được cấu hình", { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return new Response("Không có quyền", { status: 401 });
  let count = 0;
  for (let i = 0; i < 5; i++) {
    const batch = await purgeExpiredConversations();
    count += batch;
    if (batch < 100) break;
  }
  return Response.json(
    { deleted: count },
    { headers: { "Cache-Control": "no-store" } },
  );
}

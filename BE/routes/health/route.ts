import { db, row } from "@/server/db";
export const runtime = "nodejs";
export async function GET() {
  try {
    await db().prepare("SELECT 1").get();
    const ready =
      !!process.env.SAVEGATE_API_KEY &&
      !!process.env.BETTER_AUTH_SECRET &&
      !!(await row(
        "SELECT id FROM documents WHERE deleted_at IS NULL AND active_revision IS NOT NULL",
      ));
    return Response.json(
      { status: ready ? "ready" : "initializing" },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

import { getAuth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { readLimited, HttpError } from "@/server/http";
export const runtime = "nodejs";
export const GET = (request: Request) =>
  toNextJsHandler(getAuth()).GET(request);
export async function POST(request: Request) {
  try {
    const body = await readLimited(request, 32 * 1024);
    return toNextJsHandler(getAuth()).POST(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body,
        signal: request.signal,
      }),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof HttpError ? e.message : "Yêu cầu xác thực không hợp lệ.",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}

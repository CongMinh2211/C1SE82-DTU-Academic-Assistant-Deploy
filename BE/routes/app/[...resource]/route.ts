import { endpoint } from "@/server/http";
export const runtime = "nodejs";
export const maxDuration = 150;
export const GET = endpoint(async (request) => {
  const { getResource } = await import("@/server/api/get");
  return getResource(request);
});
export const POST = endpoint(async (request) => {
  const { postResource } = await import("@/server/api/post");
  return postResource(request);
});
export const PATCH = endpoint(async (request) => {
  const { patchResource } = await import("@/server/api/patch");
  return patchResource(request);
});
export const DELETE = endpoint(async (request) => {
  const { deleteResource } = await import("@/server/api/delete");
  return deleteResource(request);
});

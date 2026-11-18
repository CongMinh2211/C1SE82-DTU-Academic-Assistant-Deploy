// Mục đích file: Đọc phiên đăng nhập phía máy chủ để kiểm soát truy cập các trang ứng dụng.
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "./auth";

// React clears this memoization between server requests. Never cache a session
// across users or reuse this helper as an authorization cache in API handlers.
export const pageSession = cache(async () => {
  // Establish request context before initializing Auth; builds have no runtime secrets.
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

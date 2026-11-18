// Mục đích file: Kiểm tra cấu hình đăng nhập Google trước khi hiển thị hoặc kích hoạt chức năng.
/** Chỉ bật Google khi có đủ cấu hình ở phía máy chủ. */
export function googleOAuthConfig(
  env: Record<string, string | undefined> = process.env,
) {
  // Loại khoảng trắng thừa và chỉ trả cấu hình khi cả ID lẫn secret đều tồn tại.
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

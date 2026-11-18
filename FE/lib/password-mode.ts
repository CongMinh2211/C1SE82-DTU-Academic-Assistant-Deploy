// Phương thức chưa tải hoặc nhà cung cấp chưa biết không được coi là tài khoản Google.
export function passwordMode(methods: string[] | null): "loading" | "change" | "create" | "unavailable" {
  // Chưa tải xong thì không đoán phương thức, tránh hiện nhầm nút đổi mật khẩu.
  if (methods === null) return "loading";
  // Có credential nghĩa là đã có mật khẩu ứng dụng, kể cả khi tài khoản cũng liên kết Google.
  if (methods.includes("credential")) return "change";
  // Chỉ Google và chưa có credential: hướng dẫn tạo mật khẩu ứng dụng qua luồng xác minh.
  if (methods.includes("google")) return "create";
  return "unavailable";
}

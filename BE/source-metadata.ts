// Mục đích file: Kiểm tra và chuẩn hóa thông tin đi kèm nguồn tài liệu khi quản trị viên thêm dữ liệu.
import { officialUrl } from "./official-web";

/** Liên kết nguồn khai báo khi upload chỉ được trỏ đến website DTU. */
export function uploadSourceUrl(value?: string) {
  // URL là tùy chọn; khi có thì officialUrl kiểm tra miền DTU và giao thức.
  if (!value) return undefined;
  const source = officialUrl(value);
  const fragment = new URL(value).hash;
  // Chỉ giữ fragment chỉ trang hợp lệ, không đưa fragment tùy ý vào nguồn.
  if (/^#page=[1-9]\d{0,4}$/.test(fragment)) source.hash = fragment;
  return source.href;
}

// Danh sách quản trị bao gồm cả tài khoản Google nhưng không trả token hoặc mật khẩu.
import { row, rows } from "../db";

export async function adminUsersPage(params: URLSearchParams) {
  // Ký tự đặc biệt của LIKE được escape để tìm theo đúng nội dung đã nhập.
  const search = (params.get("q") || "").trim().slice(0, 100).toLowerCase().replace(/[\\%_]/g, "\\$&");
  const term = `%${search}%`;
  const filter = "(lower(u.name) LIKE ? ESCAPE '\\' OR lower(u.email) LIKE ? ESCAPE '\\')";
  const total = (await row<{ n: number }>(`SELECT count(*) n FROM user u WHERE ${filter}`, term, term))?.n || 0;
  const requested = Number(params.get("page"));
  // Giới hạn số trang hợp lệ, kể cả khi danh sách vừa bị thu hẹp bởi tìm kiếm.
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1), Math.max(1, Math.ceil(total / 20)));
  return {
    items: await rows(`SELECT u.id,u.name,u.email,u.role,u.banned,u.createdAt,u.studentCode,u.cohort,u.major,CASE WHEN EXISTS (SELECT 1 FROM account a WHERE a.userId=u.id AND a.providerId='google') THEN 1 ELSE 0 END google_linked FROM user u WHERE ${filter} ORDER BY u.createdAt DESC,u.id LIMIT 20 OFFSET ?`, term, term, (page - 1) * 20),
    total, page, size: 20,
  };
}

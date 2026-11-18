// Mục đích file: Hiển thị và thao tác quản lý tài khoản theo quyền phía máy chủ.
"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  AdminPagination,
  ConfirmAdminAction,
} from "@/components/admin-controls";
import { api, useResource } from "@/lib/api-client";
import { useApp } from "@/components/app-provider";
import { ResourceState } from "@/components/live-shared";
import { Badge, Button, Card, Heading, SearchInput } from "@/components/ui";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
  google_linked: number | boolean;
};

export function UserManagement() {
  // Tải danh sách và theo dõi tìm kiếm cùng trạng thái đang gửi yêu cầu.
  const { user, notify, showModal } = useApp();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Chờ ngừng gõ rồi tìm trên máy chủ để tài khoản cũ vẫn được tìm thấy.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const r = useResource<{
    items: UserRow[];
    total: number;
    page: number;
    size: number;
  }>(`admin/users?page=${page}&q=${encodeURIComponent(query)}`);
  const [busy, setBusy] = useState(false);
  function remove(target: UserRow) {
    // Mở hộp xác nhận trong ứng dụng; chỉ gọi API sau khi chọn nút Xóa vĩnh viễn.
    showModal(
      "Bạn có chắc chắn muốn xóa tài khoản này?",
      <ConfirmAdminAction
        confirmLabel="Xóa vĩnh viễn"
        onConfirm={async () => {
          await api(`admin/users/${encodeURIComponent(target.id)}/delete`, {
            method: "POST",
          });
          await r.refresh();
          notify("Đã xóa tài khoản.");
        }}
      >
        <p>
          <strong>{target.name}</strong> · {target.email}
        </p>
        <p>
          Thao tác này không thể hoàn tác. Tài khoản phải được khóa trước và
          không có lịch sử hoặc dữ liệu liên quan.
        </p>
      </ConfirmAdminAction>,
    );
  }
  const [editing, setEditing] = useState<UserRow | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fields = new FormData(e.currentTarget);
    const values = {
      name: fields.get("name"),
      email: fields.get("email"),
      role: fields.get("role"),
    };
    showModal(
      "Xác nhận thay đổi tài khoản?",
      <ConfirmAdminAction
        confirmLabel="Lưu thay đổi"
        onConfirm={async () => {
          await api(`admin/users/${encodeURIComponent(editing.id)}/update`, {
            method: "POST",
            body: JSON.stringify(values),
          });
          setEditing(null);
          await r.refresh();
          notify("Đã cập nhật thông tin tài khoản.");
        }}
      >
        <p>
          Thay email hoặc vai trò sẽ đăng xuất các phiên hiện tại của tài khoản{" "}
          <strong>{editing.email}</strong>.
        </p>
      </ConfirmAdminAction>,
    );
  }
  async function change(target: UserRow) {
    // Chọn thao tác mở khóa hoặc khóa dựa vào trạng thái tài khoản hiện tại.
    setBusy(true);
    try {
      const res = await fetch(
        `/api/auth/admin/${target.banned ? "unban-user" : "ban-user"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: target.id,
            ...(target.banned
              ? {}
              : { banReason: "Tạm khóa bởi quản trị viên" }),
          }),
        },
      );
      if (!res.ok) {
        throw new Error("Không thể thay đổi trạng thái tài khoản.");
      }
      await r.refresh();
      notify("Đã cập nhật tài khoản.");
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    // Lấy dữ liệu tài khoản mới từ biểu mẫu trước khi gửi tới dịch vụ xác thực.
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          role: "user",
        }),
      });
      if (!res.ok) {
        notify("Không thể tạo tài khoản. Kiểm tra email và mật khẩu.");
        return;
      }
      form.reset();
      await r.refresh();
      notify("Đã tạo tài khoản sinh viên.");
    } catch {
      notify("Chưa thể kết nối để tạo tài khoản. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Quản lý tài khoản"
        description="Quản lý tài khoản sinh viên, gồm cả tài khoản đăng nhập bằng Google; tạm khóa và mở lại quyền truy cập."
      />
      <div className="two-columns">
        <Card>
          <SearchInput
            placeholder="Tìm tên hoặc email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ResourceState {...r} retry={r.refresh} />
          {r.data?.items.map((u) => (
            <div className="record user-record" key={u.id}>
              <span className="record-copy">
                <strong>{u.name}</strong>
                <small>
                  {u.email} •{" "}
                  {u.role === "admin" ? "Quản trị viên" : "Sinh viên"}
                </small>
                {Boolean(u.google_linked) && <small>Đã liên kết Google</small>}
                <Badge tone={u.banned ? "red" : "teal"}>
                  {u.banned ? "Đang khóa" : "Hoạt động"}
                </Badge>
              </span>
              <div className="user-record-actions">
                <Button
                  variant="outline"
                  disabled={busy || u.id === user?.id || u.role === "admin"}
                  onClick={() => remove(u)}
                >
                  Xóa
                </Button>{" "}
                <Button
                  variant="outline"
                  disabled={busy || u.id === user?.id || u.role === "admin"}
                  onClick={() => setEditing(u)}
                >
                  Sửa
                </Button>{" "}
                <Button
                  variant="outline"
                  disabled={busy || u.id === user?.id || u.role === "admin"}
                  onClick={() => {
                    showModal(
                      u.banned ? "Mở khóa tài khoản?" : "Tạm khóa tài khoản?",
                      <ConfirmAdminAction
                        confirmLabel={u.banned ? "Mở khóa" : "Tạm khóa"}
                        onConfirm={() => change(u)}
                      >
                        <p>
                          <strong>{u.name}</strong> · {u.email}
                        </p>
                        <p>
                          {u.banned
                            ? "Tài khoản có thể đăng nhập trở lại."
                            : "Các phiên hiện tại sẽ bị đăng xuất và tài khoản không thể đăng nhập cho đến khi được mở khóa."}
                        </p>
                      </ConfirmAdminAction>,
                    );
                  }}
                >
                  {u.banned ? "Mở khóa" : "Tạm khóa"}
                </Button>
              </div>
            </div>
          ))}
          {r.data && r.data.total === 0 && (
            <p>Không tìm thấy tài khoản phù hợp.</p>
          )}
          {r.data && (
            <AdminPagination
              total={r.data.total}
              page={r.data.page}
              pageSize={r.data.size}
              onChange={setPage}
            />
          )}
        </Card>
        <Card>
          {editing ? (
            <>
              <h2>Chỉnh sửa tài khoản</h2>
              <form className="stack" onSubmit={save} key={editing.id}>
                <label className="field">
                  <span>Họ tên</span>
                  <input
                    className="input"
                    name="name"
                    defaultValue={editing.name}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    className="input"
                    name="email"
                    type="email"
                    defaultValue={editing.email}
                    readOnly={Boolean(editing.google_linked)}
                    required
                  />
                </label>
                {Boolean(editing.google_linked) && (
                  <small>
                    Email của tài khoản Google được quản lý bởi Google.
                  </small>
                )}
                <label className="field">
                  <span>Vai trò</span>
                  <select
                    className="input"
                    name="role"
                    defaultValue={editing.role}
                  >
                    <option value="user">Sinh viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </label>
                <Button type="submit" disabled={busy}>
                  Lưu thay đổi
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Hủy
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2>Tạo tài khoản sinh viên</h2>
              <form className="stack" onSubmit={create}>
                <label className="field">
                  <span>Họ tên</span>
                  <input
                    className="input"
                    name="name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input className="input" name="email" type="email" required />
                </label>
                <label className="field">
                  <span>Mật khẩu ban đầu (từ 12 ký tự)</span>
                  <input
                    className="input"
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? "Đang xử lý…" : "Tạo tài khoản"}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

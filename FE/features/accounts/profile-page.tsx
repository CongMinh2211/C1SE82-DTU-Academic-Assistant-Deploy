// Mục đích file: Hiển thị và cập nhật thông tin hồ sơ được phép chỉnh sửa.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useApp } from "@/components/app-provider";
import { Button, Card, Heading } from "@/components/ui";

export function ProfilePage() {
  // Đọc hồ sơ phiên hiện tại và theo dõi trạng thái chỉnh sửa, đang gửi, lỗi.
  const { user, notify, language } = useApp();
  const t = (text: string) => studentPageText(language, text);
  const router = useRouter();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    // Thu thập các trường được phép từ form; phía API tiếp tục kiểm tra quyền và dữ liệu.
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("me", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      // Đóng chế độ sửa và tải lại dữ liệu để giao diện phản ánh hồ sơ vừa lưu.
      setEditing(false);
      router.refresh();
      notify(t("Đã cập nhật hồ sơ."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Mở lại các nút dù yêu cầu thành công hay thất bại.
      setBusy(false);
    }
  }
  return (
    <div className="account-page">
      <Heading
        title={t("Thông tin tài khoản")}
        description={t("Quản lý hồ sơ của bạn trong ứng dụng trợ lý học vụ.")}
        action={
          !editing ? (
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setEditing(true);
              }}
            >
              {t("Chỉnh sửa hồ sơ")}
            </Button>
          ) : undefined
        }
      />
      <Card className="account-card">
        <div className="account-identity">
          <div className="account-avatar" aria-hidden="true">{user?.name?.trim().charAt(0).toLocaleUpperCase() || "?"}</div>
          <div className="account-identity-copy">
            <strong>{user?.name || t("Chưa cập nhật")}</strong>
            <span>{user?.email}</span>
          </div>
          <span className="account-role">{user?.role === "admin" ? t("Quản trị viên") : t("Sinh viên")}</span>
        </div>
        <div className="account-section-heading"><h2>{t("Hồ sơ cơ bản")}</h2></div>
        {editing ? (
          <form className="stack" onSubmit={saveProfile}>
            <fieldset disabled={busy} className="profile-form-grid">
              <label className="field">
                <span>{t("Họ tên")}</span>
                <input
                  className="input"
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  defaultValue={user?.name}
                  required
                />
              </label>
              <label className="field">
                <span>{t("Mã sinh viên")}</span>
                <input
                  className="input"
                  name="studentCode"
                  maxLength={32}
                  defaultValue={user?.studentCode || ""}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>{t("Khóa")}</span>
                <input
                  className="input"
                  name="cohort"
                  maxLength={5}
                  placeholder={t("Ví dụ: K29")}
                  defaultValue={user?.cohort || ""}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>{t("Chuyên ngành")}</span>
                <input
                  className="input"
                  name="major"
                  maxLength={160}
                  defaultValue={user?.major || ""}
                  autoComplete="off"
                />
              </label>
            </fieldset>
            <p className="muted">
              {t("Email và vai trò được quản lý theo tài khoản đăng nhập.")}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <Button type="submit" disabled={busy}>
                {busy ? t("Đang lưu…") : t("Lưu hồ sơ")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                {t("Hủy")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="profile-details">
            {[
              [t("Họ tên"), user?.name],
              ["Email", user?.email],
              [
                t("Vai trò"),
                user?.role === "admin" ? t("Quản trị viên") : t("Sinh viên"),
              ],
              [t("Mã sinh viên"), user?.studentCode || t("Chưa cập nhật")],
              [t("Khóa"), user?.cohort || t("Chưa cập nhật")],
              [t("Chuyên ngành"), user?.major || t("Chưa cập nhật")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="account-note">
          {t("Đây là hồ sơ của ứng dụng, chưa đồng bộ với myDTU.")}
        </p>
      </Card>
    </div>
  );
}

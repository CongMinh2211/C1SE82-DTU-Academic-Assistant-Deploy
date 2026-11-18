// Thao tác tài khoản và phiên đăng nhập dùng Better Auth để máy chủ kiểm tra quyền.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { routes } from "@/lib/routes";
import { api } from "@/lib/api-client";
import { Button, Card } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { ConfirmAdminAction } from "@/components/admin-controls";

type Account = { id: string; accountId: string; providerId: string };
type SessionInfo = {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  userAgent?: string | null;
};
export type SettingsSection = "account" | "security" | "appearance" | "language" | "notifications" | "data" | "support";

// Chuyển chuỗi trình duyệt dài thành tên thiết bị gần gũi; không suy đoán vị trí.
function deviceName(agent: string | null | undefined, language: "vi" | "en" | "hi") {
  const t = (value: string) => studentPageText(language, value);
  if (!agent) return t("Thiết bị không xác định");
  const browser = /Edg\//.test(agent)
    ? "Microsoft Edge"
    : /Chrome\//.test(agent)
      ? "Google Chrome"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Safari\//.test(agent)
          ? "Safari"
          : /curl\//i.test(agent)
            ? t("Công cụ dòng lệnh")
            : t("Trình duyệt khác");
  const os = /Windows/i.test(agent)
    ? "Windows"
    : /Android/i.test(agent)
      ? "Android"
      : /iPhone|iPad/i.test(agent)
        ? "iOS"
        : /Macintosh/i.test(agent)
          ? "macOS"
          : /Linux/i.test(agent)
            ? "Linux"
            : t("Thiết bị khác");
  return `${browser} · ${os}`;
}

export function SecuritySettings({ section }: { section: SettingsSection }) {
  const { user, notify, showModal, language } = useApp();
  const t = (value: string) => studentPageText(language, value);
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionFreshRequired, setSessionFreshRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tải từng chức năng độc lập để lỗi phiên không chặn liên kết Google hoặc quyền riêng tư.
  async function loadAccounts() {
    setAccountError("");
    try {
      const result = await authClient.listAccounts();
      if (result.error) throw result.error;
      setAccounts(result.data || []);
    } catch { setAccountError(t("Không thể tải phương thức đăng nhập. Vui lòng thử lại.")); }
  }
  async function loadSessions() {
    setSessionError(""); setSessionFreshRequired(false);
    try {
      const result = await authClient.listSessions();
      if (result.error) {
        if (result.error.code === "SESSION_NOT_FRESH") {
          setSessionFreshRequired(true);
          setSessionError(t("Phiên đăng nhập đã cũ. Hãy đăng xuất và đăng nhập lại để xem các phiên khác."));
          return;
        }
        throw result.error;
      }
      setSessions(result.data || []);
    } catch { setSessionError(t("Không thể tải phiên đăng nhập. Vui lòng thử lại.")); }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (section === "account") void loadAccounts();
      if (section === "security") void loadSessions();
    }, 0);
    return () => clearTimeout(timer);
  // Chỉ tải lại khi đổi mục, tài khoản hoặc ngôn ngữ; không gọi API khi xem quyền riêng tư.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, user?.id, language]);
  const google = accounts?.find((a) => a.providerId === "google");
  const alternative = accounts?.some((a) => a.providerId !== "google");
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError(t("Không thể hoàn thành thao tác. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {section === "account" && (
        <Card className="account-card settings-card settings-panel">
          <h2>{t("Tài khoản")}</h2>
          <p className="muted">{t("Quản lý thông tin cá nhân và phương thức đăng nhập của bạn.")}</p>
          <div className="settings-profile-summary">
            <span className="settings-profile-avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
            <div><strong>{user?.name}</strong><p className="muted">{user?.email}</p></div>
            <Link className="settings-profile-link" href={routes.profile}>{t("Chỉnh sửa hồ sơ →")}</Link>
          </div>
          <div className="settings-section-heading"><h3>{t("Đăng nhập bằng Google")}</h3><span className="settings-status">{accounts === null ? (accountError ? "—" : "…") : google ? t("Đã liên kết") : t("Chưa liên kết")}</span></div>
          <p className="muted">
            {accounts === null
              ? (accountError ? "" : t("Đang tải phương thức đăng nhập…"))
              : google
                ? t("Tài khoản đã liên kết với Google.")
                : t("Chưa liên kết Google.")}
          </p>
          {accounts &&
            (google ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !alternative}
                onClick={() => {
                  showModal(
                    t("Hủy liên kết Google?"),
                    <ConfirmAdminAction
                      language={language}
                      confirmLabel={t("Hủy liên kết")}
                      onConfirm={async () => {
                        const result = await authClient.unlinkAccount({
                          accountId: google.id,
                        });
                        if (result.error)
                          throw new Error(
                            result.error.message || "Không thể hủy liên kết.",
                          );
                        await loadAccounts();
                        notify(t("Đã hủy liên kết Google."));
                      }}
                    >
                      <p>

            {t("Bạn sẽ không thể dùng tài khoản Google này để đăng nhập cho đến khi liên kết lại.")}
                      </p>
                    </ConfirmAdminAction>,
                  );
                }}
              >
                {t("Hủy liên kết Google")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const result = await authClient.linkSocial({
                      provider: "google",
                      callbackURL:
                        user?.role === "admin"
                          ? routes.adminSettings
                          : routes.settings,
                    });
                    if (result.error) throw result.error;
                  })
                }
              >
                {t("Liên kết Google")}
              </Button>
            ))}
          {google && !alternative && (
            <p className="muted">
              {t("Không thể gỡ phương thức đăng nhập duy nhất của bạn.")}
            </p>
          )}
          {accountError && <div role="alert"><p className="form-error">{accountError}</p><Button type="button" variant="outline" onClick={() => void loadAccounts()}>{t("Thử tải lại")}</Button></div>}
          {error && <p role="alert" className="form-error">{error}</p>}
        </Card>
      )}
      {section === "security" && (
        <Card className="account-card settings-card settings-panel">
          <h2>{t("Bảo mật và phiên đăng nhập")}</h2>
          <p className="muted">

            {t("Danh sách thiết bị là thông tin trình duyệt gửi; không dùng để xác định chính xác vị trí.")}
          </p>
          <p className="settings-info">{t("Quên mật khẩu? Chọn “Quên mật khẩu?” trên trang đăng nhập để khôi phục qua email.")}</p>
          {sessionError && (
            <>
              <p role="alert" className="form-error">
                {sessionError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadSessions()}
              >
                {t("Thử tải lại")}
              </Button>
            </>
          )}
          {sessionError ? null : sessions === null ? (
            <p>{t("Đang tải phiên đăng nhập…")}</p>
          ) : sessions.length ? (
            <ul className="settings-session-list">
              {sessions.map((item) => (
                <li key={item.id}>
                  <span className="settings-session-icon" aria-hidden="true">
                    ◉
                  </span>
                  <span>
                    <strong>{deviceName(item.userAgent, language)}</strong>
                    <small>
                      {t("Hoạt động:")}{" "}
                      {new Date(item.updatedAt).toLocaleString(language === "hi" ? "hi-IN" : language === "en" ? "en-US" : "vi-VN")}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("Không có phiên nào để hiển thị.")}</p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || sessionFreshRequired}
            onClick={() => {
              showModal(
                t("Đăng xuất các thiết bị khác?"),
                <ConfirmAdminAction
                      language={language}
                  confirmLabel={t("Đăng xuất các phiên khác")}
                  onConfirm={async () => {
                    const result = await authClient.revokeOtherSessions();
                    if (result.error)
                      throw new Error(
                        result.error.message || "Không thể thu hồi phiên.",
                      );
                    await loadSessions();
                    notify(t("Đã đăng xuất các phiên khác."));
                  }}
                >
                  <p>

            {t("Các phiên khác sẽ phải đăng nhập lại. Phiên hiện tại vẫn được giữ.")}
                  </p>
                </ConfirmAdminAction>,
              );
            }}
          >
            {t("Đăng xuất các phiên khác")}
          </Button>{" "}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              showModal(
                t("Đăng xuất tài khoản?"),
                <ConfirmAdminAction
                      language={language}
                  confirmLabel={t("Đăng xuất")}
                  onConfirm={async () => {
                    const result = await authClient.signOut();
                    if (result.error)
                      throw new Error(
                        result.error.message || "Không thể đăng xuất.",
                      );
                    router.replace(routes.login);
                    router.refresh();
                  }}
                >
                  <p>

            {t("Bạn cần đăng nhập lại để tiếp tục sử dụng trên thiết bị này.")}
                  </p>
                </ConfirmAdminAction>,
              )
            }
          >
            {t("Đăng xuất tài khoản này")}
          </Button>
        </Card>
      )}
      {section === "data" && (
        <Card className="account-card settings-card settings-panel">
          <h2>{t("Dữ liệu và quyền riêng tư")}</h2>
          <p>

            {t("Xuất toàn bộ hội thoại và nguồn thành JSON, hoặc chuyển lịch sử vào thùng rác để có thể khôi phục.")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const data = await api("conversations/export");
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json;charset=utf-8",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "dtu-hoi-thoai.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                notify(t("Đã xuất dữ liệu hội thoại."));
              })
            }
          >
            {t("Xuất dữ liệu hội thoại")}
          </Button>{" "}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              showModal(
                t("Chuyển toàn bộ lịch sử vào thùng rác?"),
                <ConfirmAdminAction
                      language={language}
                  confirmLabel={t("Chuyển vào thùng rác")}
                  onConfirm={async () => {
                    const result = await api<{ count: number }>(
                      "conversations/all",
                      { method: "DELETE" },
                    );
                    notify(
                      language === "en" ? `${result.count} conversations moved to trash.` : language === "hi" ? `${result.count} बातचीत कचरा पेटी में भेजी गईं।` : `Đã chuyển ${result.count} hội thoại vào thùng rác.`,
                    );
                  }}
                >
                  <p>

            {t("Các liên kết chia sẻ sẽ bị thu hồi. Bạn có thể khôi phục từng hội thoại trong vòng 30 ngày; sau đó nội dung sẽ bị xóa vĩnh viễn.")}
                  </p>
                </ConfirmAdminAction>,
              );
            }}
          >
            {t("Xóa lịch sử hội thoại")}
          </Button>
          <p>
            <Link href={routes.history}>{t("Lịch sử hội thoại →")}</Link>
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </Card>
      )}
      {section === "support" && (
        <Card className="account-card settings-card settings-panel">
          <h2>{t("Hỗ trợ")}</h2>
          <p className="muted">
            {t("Tìm câu trả lời hoặc gửi góp ý cho nhóm quản trị.")}
          </p>
          <p>
            <Link href={routes.faq}>{t("Trung tâm trợ giúp và FAQ →")}</Link>
          </p>
          <p>
            <Link href={routes.feedback}>{t("Gửi góp ý hoặc báo lỗi →")}</Link>
          </p>
          <p className="muted">{t("Phiên bản ứng dụng: 0.1.0")}</p>
        </Card>
      )}
    </>
  );
}

// Mục đích file: Hiển thị các tùy chọn cài đặt tài khoản được ứng dụng hỗ trợ.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import { useEffect, useState, type FormEvent } from "react";
import { appearanceKey, defaultAppearance, parseAppearance, type Appearance } from "@/lib/appearance";
import { languageText, languageNames, type AnswerLanguage, type UiLanguage } from "@/lib/language";
import { authClient } from "@/lib/auth-client";
import { useApp } from "@/components/app-provider";
import { Button, Card, Heading, Icon } from "@/components/ui";
import { passwordMode } from "@/lib/password-mode";
import { OtpForm } from "@/features/auth/otp-form";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { SecuritySettings, type SettingsSection } from "./security-settings";
import { NotificationSettings } from "./notification-settings";

export function SettingsPage() {
  const { notify, user, language, selectedLanguage, setLanguage, answerLanguage, setAnswerLanguage, languageReady } = useApp();
  const text = languageText[language];
  const t = (value: string) => studentPageText(language, value);
  const router = useRouter();
  const [methods, setMethods] = useState<string[] | null>(null);
  const [methodError, setMethodError] = useState("");
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [creatingPassword, setCreatingPassword] = useState(false);
  async function loadMethods() {
    setMethodError("");
    try {
      const [result, configResponse] = await Promise.all([authClient.listAccounts(), fetch("/api/public/auth-config", {cache:"no-store"})]);
      if (result.error || !configResponse.ok) throw new Error("methods unavailable");
      const config = await configResponse.json() as {otpEnabled?:boolean};
      setMethods((result.data || []).map(account => account.providerId));
      setOtpEnabled(config.otpEnabled === true);
    } catch { setMethods(null); setMethodError(t("Không thể tải phương thức đăng nhập. Vui lòng thử lại.")); }
  }
  useEffect(() => { if (!user?.id) return; const timer = setTimeout(() => void loadMethods(),0); return () => clearTimeout(timer); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = passwordMode(methods);
  const [languageError, setLanguageError] = useState("");
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [appearanceError, setAppearanceError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setAppearance(parseAppearance(localStorage.getItem(appearanceKey(user?.id)))); }
      catch { setAppearanceError(studentPageText(language, "Không thể đọc cài đặt trên trình duyệt này.")); }
    }, 0);
    return () => clearTimeout(timer);
  }, [user?.id, language]);
  function saveAppearance(next: Appearance) {
    try {
      localStorage.setItem(appearanceKey(user?.id), JSON.stringify(next));
      setAppearance(next); setAppearanceError("");
      window.dispatchEvent(new Event("dtu:appearance"));
      notify(t("Đã lưu cài đặt giao diện trên trình duyệt này."));
    } catch { setAppearanceError(t("Không thể lưu. Hãy kiểm tra quyền lưu trữ của trình duyệt.")); }
  }
  // Mỗi mục chỉ mở nội dung tương ứng, tránh dồn mọi biểu mẫu vào một trang dài.
  const [section, setSection] = useState<SettingsSection>("account");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    // Kiểm tra mật khẩu xác nhận và yêu cầu mật khẩu mới khác trước khi gọi dịch vụ.
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    if (data.get("new") !== data.get("confirm")) {
      setError(t("Mật khẩu xác nhận chưa khớp."));
      return;
    }
    if (data.get("current") === data.get("new")) {
      setError(t("Mật khẩu mới cần khác mật khẩu hiện tại."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Thu hồi các phiên khác sau khi đổi mật khẩu thành công theo cấu hình yêu cầu.
      const result = await authClient.changePassword({
        currentPassword: String(data.get("current")),
        newPassword: String(data.get("new")),
        revokeOtherSessions: true,
      });
      if (result.error)
        throw new Error(
          t("Không thể đổi mật khẩu. Kiểm tra mật khẩu hiện tại và mật khẩu mới từ 12 ký tự."),
        );
      form.reset();
      notify(t("Đã đổi mật khẩu và đăng xuất các phiên khác."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={text.settings}
        description={text.description}
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Các mục cài đặt">
          <p className="settings-nav-label">{text.navigation}</p>
          {([
            ["account", text.account, "user"],
            ["security", text.security, "shield"],
            ["appearance", text.appearance, "home"],
            ["language", text.language, "chat"],
            ["notifications", text.notifications, "bell"],
            ["data", text.data, "file"],
          ] as const).map(([key, label, icon]) => <button key={key} type="button" className={`settings-nav-item ${section === key ? "is-active" : ""}`} aria-pressed={section === key} onClick={() => setSection(key)}><Icon name={icon} size={20} /><span>{label}</span><span className="settings-nav-arrow" aria-hidden="true">›</span></button>)}
        </nav>
        <div className="settings-content">
          <SecuritySettings section={section} />
          {section === "data" && <SecuritySettings section="support" />}
          {section === "appearance" && <Card className="account-card settings-card settings-panel">
            <h2>{t("Giao diện")}</h2><p className="muted">{t("Tùy chỉnh cách hiển thị trên trình duyệt này.")}</p>
            <div className="settings-feature-list">
              <label className="settings-feature-row"><span><strong>{t("Chế độ hiển thị")}</strong><p>{t("Sáng, tối hoặc theo thiết bị")}</p></span>
                <select className="input settings-select" value={appearance.theme} onChange={e => saveAppearance({ ...appearance, theme: e.target.value as Appearance["theme"] })} aria-label={t("Chế độ hiển thị")}><option value="light">{t("Sáng")}</option><option value="dark">{t("Tối")}</option><option value="system">{t("Theo thiết bị")}</option></select></label>
              <label className="settings-feature-row"><span><strong>{t("Kích thước chữ")}</strong><p>{t("Phóng to giao diện để dễ đọc hơn")}</p></span>
                <select className="input settings-select" value={appearance.size} onChange={e => saveAppearance({ ...appearance, size: e.target.value as Appearance["size"] })} aria-label={t("Kích thước chữ")}><option value="normal">{t("Mặc định")}</option><option value="large">{t("Lớn")}</option><option value="extra">{t("Rất lớn")}</option></select></label>
            </div><p className="settings-info">{t("Cài đặt được lưu trên trình duyệt này và không tự đồng bộ sang thiết bị khác.")}</p>{appearanceError && <p role="alert" className="form-error">{appearanceError}</p>}
          </Card>}
          {section === "language" && <Card className="account-card settings-card settings-panel"><h2>{text.language}</h2><p className="muted">{text.languageIntro}</p><div className="settings-feature-list">
            <label className="settings-feature-row"><span><strong>{text.appLanguage}</strong><p>{text.languageHelp}</p></span><select className="input settings-select" value={selectedLanguage} aria-label={text.appLanguage} disabled={!languageReady} onChange={async e => { const next=e.target.value as UiLanguage; if (await setLanguage(next)) {setLanguageError(""); notify(languageText[next].saved);} else setLanguageError(text.error); }}>{(Object.entries(languageNames) as [UiLanguage,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="settings-feature-row"><span><strong>{text.aiLanguage}</strong><p>{text.aiHelp}</p></span><select className="input settings-select" aria-label={text.aiLanguage} value={answerLanguage} disabled={!languageReady} onChange={async e => { const next=e.target.value as AnswerLanguage; if (await setAnswerLanguage(next)) { setLanguageError(""); notify(text.saved); } else setLanguageError(text.error); }}><option value="auto">{text.auto}</option>{(Object.entries(languageNames) as [UiLanguage,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><p className="settings-info">{text.scope}</p>{languageError && <p className="form-error" role="alert">{languageError}</p>}</Card>}
          {section === "notifications" && <NotificationSettings key={user?.id} />}
          {section === "account" && <Card className="account-card settings-card settings-panel">
        {mode === "loading" ? <><h2>{t("Mật khẩu ứng dụng")}</h2><p role={methodError ? "alert" : "status"}>{methodError || t("Đang tải phương thức đăng nhập…")}</p>{methodError && <Button variant="outline" onClick={() => void loadMethods()}>{t("Thử lại")}</Button>}</> : mode === "change" ? <>
        <h2>{t("Đổi mật khẩu")}</h2>
        <p className="muted">
          {t("Sau khi đổi mật khẩu, các phiên đăng nhập khác sẽ được đăng xuất.")}
        </p>
        <p className="settings-info">{t("Đây là mật khẩu ứng dụng, không phải mật khẩu Google.")}</p>
        <form className="stack" onSubmit={changePassword}>
          <label className="field">
            <span>{t("Mật khẩu hiện tại")}</span>
            <input
              className="input"
              name="current"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              disabled={busy}
              required
            />
          </label>
          <label className="field">
            <span>{t("Mật khẩu mới")}</span>
            <input
              className="input"
              name="new"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              aria-describedby="password-rule"
              disabled={busy}
              required
            />
            <small id="password-rule">{t("Từ 12 đến 128 ký tự.")}</small>
          </label>
          <label className="field">
            <span>{t("Xác nhận mật khẩu mới")}</span>
            <input
              className="input"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              disabled={busy}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? t("Đang lưu…") : t("Lưu mật khẩu mới")}
          </Button>
        </form></> : mode === "create" ? <>
          <h2>{t("Tạo mật khẩu đăng nhập")}</h2>
          <p className="muted">{t("Tài khoản của bạn chưa có mật khẩu ứng dụng. Mật khẩu này tách biệt với mật khẩu Google.")}</p>
          {creatingPassword && user?.email ? <OtpForm initialEmail={user.email} mode="create" language={language} onBack={() => setCreatingPassword(false)} onDone={() => router.push(routes.login)} /> : otpEnabled && user?.email ? <Button onClick={() => setCreatingPassword(true)}>{t("Tạo mật khẩu đăng nhập")}</Button> : <p className="settings-info">{t("Chưa thể gửi mã xác minh qua email. Vui lòng liên hệ quản trị viên.")}</p>}
        </> : <><h2>{t("Mật khẩu ứng dụng")}</h2><p className="settings-info">{t("Không xác định được phương thức đăng nhập. Vui lòng liên hệ quản trị viên.")}</p></>}
          </Card>}
        </div>
      </div>
    </>
  );
}

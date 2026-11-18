// Tách gửi mã, xác minh và đặt mật khẩu; máy chủ kiểm tra lại mã khi đổi mật khẩu.
"use client";
import { useState, type FormEvent } from "react";
import { studentPageText } from "@/lib/student-page-text";
import type { UiLanguage } from "@/lib/language";
import { Button } from "@/components/ui";

export function OtpForm({ initialEmail, onBack, onDone, mode, language = "vi" }: { initialEmail: string; mode: "reset" | "create"; onBack: () => void; onDone?: () => void; language?: UiLanguage }) {
  const t = (value: string) => studentPageText(language, value);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "code" | "password" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function call(endpoint: string, body: object) {
    const res = await fetch(`/api/auth/${endpoint}`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    if (!res.ok) throw new Error(t("Mã không đúng, đã hết hạn hoặc bạn đã thử quá nhiều lần. Hãy thử lại hoặc gửi mã mới."));
  }
  async function send() {
    setBusy(true); setError(""); setNotice("");
    try {
      await call("email-otp/request-password-reset", {email});
      setOtp(""); setStep("code");
      setNotice(t("Nếu địa chỉ hợp lệ cho yêu cầu này, mã sẽ được gửi. Vui lòng kiểm tra hộp thư và thư rác."));
    } catch { setError(t("Không thể gửi mã lúc này. Vui lòng chờ rồi thử lại.")); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "email") { await send(); return; }
    if (step === "done") return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      if (step === "code") {
        // Kiểm tra mã trên server, không chỉ kiểm tra đủ sáu chữ số ở giao diện.
        await call("email-otp/check-verification-otp", {email, otp, type:"forget-password"});
        setStep("password");
        setNotice(t("Mã hợp lệ. Bạn hãy tạo mật khẩu mới."));
      } else {
        const password = String(data.get("password") || "");
        if (password !== data.get("confirm")) throw new Error(t("Mật khẩu xác nhận chưa khớp."));
        // API kiểm tra lại hạn, số lần thử và mã trước khi cập nhật mật khẩu.
        await call("email-otp/reset-password", {email, otp, password});
        setOtp(""); setStep("done");
        setNotice(mode === "create" ? t("Đã tạo mật khẩu ứng dụng. Vì lý do bảo mật, hãy đăng nhập lại.") : t("Đã đặt lại mật khẩu. Bạn có thể quay lại đăng nhập."));
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("Không thể xử lý yêu cầu.")); }
    finally { setBusy(false); }
  }
  return <form className="login-form" onSubmit={submit}>
    <h2 className="login-title">{step === "code" ? t("Nhập mã xác minh") : step === "password" ? t("Tạo mật khẩu mới") : mode === "create" ? t("Tạo mật khẩu đăng nhập") : t("Đặt lại mật khẩu")}</h2>
    <p>{step === "email" ? (mode === "create" ? t("Mã xác minh sẽ được gửi đến email tài khoản đang đăng nhập. Mã có hiệu lực 5 phút.") : t("Nhập email tài khoản để nhận mã xác minh 6 chữ số. Mã có hiệu lực 5 phút.")) : step === "code" ? `${t("Mã xác minh đã được gửi đến:")} ${email}` : step === "password" ? t("Nhập mật khẩu mới cho tài khoản của bạn.") : mode === "create" ? t("Bạn đã tạo mật khẩu ứng dụng.") : t("Bạn đã hoàn tất khôi phục tài khoản.")}</p>
    {step === "email" && <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} readOnly={mode === "create"} required maxLength={254} autoComplete="email" /></label>}
    {step === "code" && <label className="field"><span>{t("Mã xác minh") }</span><input className="input" value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>}
    {step === "password" && <><label className="field"><span>{t("Mật khẩu mới") }</span><input className="input" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><label className="field"><span>{t("Xác nhận mật khẩu") }</span><input className="input" name="confirm" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label></>}
    {notice && <p role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {step !== "done" && <Button type="submit" disabled={busy}>{busy ? t("Đang xử lý…") : step === "email" ? t("Gửi mã") : step === "code" ? t("Xác minh mã") : mode === "create" ? t("Tạo mật khẩu đăng nhập") : t("Đặt lại mật khẩu")}</Button>}
    {(step === "code" || step === "password") && <Button type="button" variant="outline" disabled={busy} onClick={() => void send()}>{t("Gửi lại mã") }</Button>}
    {step === "code" && mode === "reset" && <Button type="button" variant="outline" disabled={busy} onClick={() => {setStep("email");setOtp("");setNotice("");setError("");}}>{t("Đổi email") }</Button>}
    <Button type="button" variant="outline" disabled={busy} onClick={step === "done" && onDone ? onDone : onBack}>{mode === "create" && step !== "done" ? t("Hủy") : t("Về đăng nhập")}</Button>
  </form>;
}

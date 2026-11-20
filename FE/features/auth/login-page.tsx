// Mục đích file: Hiển thị và xử lý biểu mẫu đăng nhập, đăng ký và các lựa chọn xác thực được hỗ trợ.
"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@fortawesome/fontawesome-svg-core";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { authClient } from "@/lib/auth-client";
import { OtpForm } from "./otp-form";
import { api } from "@/lib/api-client";
import { routes } from "@/lib/routes";
import { feedbackLoginPath, feedbackPath, validFeedbackId } from "@/lib/feedback-link";
import { useApp } from "@/components/app-provider";
import {
  Badge,
  Button,
  ButtonLink,
  CampusImage,
  Icon,
  Logo,
} from "@/components/ui";

config.autoAddCss = false;

export function LoginPage({
  register = false,
  reset = false,
  googleEnabled = false,
  otpEnabled = false,
  feedbackId = null,
}: {
  register?: boolean;
  reset?: boolean;
  googleEnabled?: boolean;
  otpEnabled?: boolean;
  feedbackId?: string | null;
}) {
  const notificationFeedback = !register && !reset ? validFeedbackId(feedbackId) : null;
  const loginReturn = notificationFeedback ? feedbackLoginPath(notificationFeedback) : routes.login;
  const router = useRouter(),
    params = useSearchParams(),
    { notify } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [forgot, setForgot] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const [otpMode, setOtpMode] = useState<"reset" | null>(null);
  const [otpEmail, setOtpEmail] = useState("");
  // Ngăn tải lại trang, khóa nút gửi và xóa lỗi cũ trước mỗi lần xác thực.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get("email") || ""),
        password = String(data.get("password") || "");
      // Nhánh quên mật khẩu chỉ yêu cầu gửi liên kết, không tiết lộ email có tồn tại hay không.
      if (forgot) {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: routes.resetPassword,
        });
        if (result.error)
          throw new Error(
            "Chưa thể gửi email đặt lại mật khẩu. Vui lòng liên hệ quản trị viên.",
          );
        notify(
          "Nếu tài khoản tồn tại và email đã được cấu hình, liên kết đặt lại mật khẩu sẽ được gửi.",
        );
        setForgot(false);
        return;
      }
      // Token trong đường dẫn xác định yêu cầu đặt lại mật khẩu đang được xử lý.
      if (reset) {
        const token = params.get("token");
        if (!token) throw new Error("Liên kết không hợp lệ.");
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error)
          throw new Error("Liên kết đã hết hạn hoặc mật khẩu không hợp lệ.");
        notify("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        router.replace(routes.login);
        return;
      }
      // Dùng cùng biểu mẫu cho đăng ký và đăng nhập, chọn API theo chế độ hiện tại.
      const result = register
        ? await authClient.signUp.email({
            email,
            password,
            name: String(data.get("name")),
          })
        : await authClient.signIn.email({ email, password });
      if (result.error)
        throw new Error(
          register
            ? "Không thể tạo tài khoản. Kiểm tra email và mật khẩu từ 12 ký tự, hoặc đăng nhập nếu email đã được dùng."
            : "Email hoặc mật khẩu chưa đúng, hoặc tài khoản đang bị khóa.",
        );
      // Lấy vai trò đã được máy chủ xác nhận để chuyển tới khu vực phù hợp.
      const profile = await api<{ user: { role: string } }>("me");
      router.replace(
        notificationFeedback ? feedbackPath(notificationFeedback) : profile.user.role === "admin" ? routes.dashboard : routes.home,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể đăng nhập.");
    } finally {
      // Mở lại nút gửi kể cả khi xác thực hoặc lấy hồ sơ thất bại.
      setBusy(false);
    }
  }
  // Đăng nhập nhanh Google không cần OAuth Console (Student & Admin)
  async function quickGoogleLogin(role: "student" | "admin" = "student") {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/public/quick-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Không thể đăng nhập nhanh bằng Google.");
      }
      notify(
        role === "admin"
          ? "Đã đăng nhập nhanh: Quản trị viên Google DTU"
          : "Đã đăng nhập nhanh: Sinh viên Google DTU",
      );
      const profile = await api<{ user: { role: string } }>("me");
      router.replace(
        notificationFeedback
          ? feedbackPath(notificationFeedback)
          : profile.user.role === "admin"
            ? routes.dashboard
            : routes.home,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể đăng nhập nhanh với Google.");
      setBusy(false);
    }
  }

  // Chuyển sang luồng Google; khi lỗi OAuth hoặc chưa cấu hình Console, tự động chuyển sang Đăng nhập nhanh Google
  async function signInWithGoogle() {
    setError("");
    setBusy(true);
    try {
      if (!googleEnabled) {
        await quickGoogleLogin("student");
        return;
      }
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: loginReturn,
        errorCallbackURL: loginReturn,
      });
      if (result.error) {
        console.warn("Google OAuth chưa sẵn sàng, tự động dùng Đăng nhập nhanh Google:", result.error);
        notify("Đang tự động chuyển sang Đăng nhập nhanh Google DTU...");
        await quickGoogleLogin("student");
      }
    } catch (error) {
      console.warn("Lỗi Google OAuth, tự động dùng Đăng nhập nhanh Google:", error);
      notify("Đang tự động chuyển sang Đăng nhập nhanh Google DTU...");
      await quickGoogleLogin("student");
    }
  }
  return (
    <main className="login-page">
      <div className="login-card">
        <section className="login-welcome">
          <Logo variant="login" />
          <h1>{"Học vụ dễ hiểu.\nTự tin mỗi ngày."}</h1>
          <p>
            Một nơi để hỏi, tìm nguồn và hiểu rõ các quy định dành cho sinh viên
            Duy Tân.
          </p>
          <CampusImage priority />
          <div className="login-benefits">
            {[
              "Câu trả lời gắn với nguồn tài liệu",
              "Dễ dàng xem lại lịch sử hỏi đáp",
              "Thông báo rõ khi chưa đủ căn cứ",
            ].map((t) => (
              <div key={t}>
                <Icon name="check" tone="white" />
                <span>{t}</span>
              </div>
            ))}
          </div>
          <small>DTU Academic Assistant • C1SE.82</small>
        </section>
        {otpMode ? <OtpForm key={`${otpMode}-${otpEmail}`} mode={otpMode} initialEmail={otpEmail} onBack={() => { setOtpMode(null); router.replace(loginReturn); }} /> : <form className="login-form" onSubmit={submit}>
          <div className="login-form-spacer" />
          <Badge>
            {register
              ? "TẠO TÀI KHOẢN"
              : reset
                ? "BẢO MẬT TÀI KHOẢN"
                : "CHÀO MỪNG TRỞ LẠI"}
          </Badge>
          <h2 className="login-title">
            {register
              ? "Bắt đầu cùng trợ lý"
              : reset
                ? "Đặt mật khẩu mới"
                : forgot
                  ? "Khôi phục tài khoản"
                  : "Đăng nhập để bắt đầu"}
          </h2>
          <p>
            Tài khoản riêng của ứng dụng trợ lý học vụ. Không dùng mật khẩu
            myDTU.
          </p>
          {register && (
            <label className="field">
              <span>Họ và tên</span>
              <input
                className="input"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          )}
          {!reset && (
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Nhập email của bạn"
                maxLength={254}
                required
              />
            </label>
          )}
          {!forgot && (
            <label className="field">
              <span>Mật khẩu{register || reset ? " (từ 12 ký tự)" : ""}</span>
              <span className="password-input">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  aria-label={
                    register || reset ? "Mật khẩu (từ 12 ký tự)" : "Mật khẩu"
                  }
                  name="password"
                  autoComplete={
                    register || reset ? "new-password" : "current-password"
                  }
                  minLength={register || reset ? 12 : 1}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </span>
            </label>
          )}
          {!register && !reset && (
            <div className="login-options">
              <small>Bảo vệ thông tin tài khoản</small>
              <button
                type="button"
                onClick={() => {
                  if (otpEnabled) { setOtpEmail(""); setOtpMode("reset"); }
                  else setForgot(!forgot);
                  setError("");
                }}
              >
                {forgot ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
              </button>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Đang xử lý…"
              : register
                ? "Tạo tài khoản sinh viên"
                : reset
                  ? "Lưu mật khẩu mới"
                  : forgot
                    ? "Gửi liên kết đặt lại"
                    : "Đăng nhập"}
          </Button>
          {!reset && !forgot && (
            <div className="d-flex flex-column gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                className="d-inline-flex align-items-center justify-content-center gap-2"
                disabled={busy}
                onClick={signInWithGoogle}
              >
                <FontAwesomeIcon icon={faGoogle} aria-hidden="true" style={{ color: "#4285F4" }} />
                <span>Đăng nhập với Google</span>
              </Button>

              <div className="text-center my-1" style={{ fontSize: 13, color: "#7a8fa6" }}>
                <span>— hoặc đăng nhập nhanh 1 chạm —</span>
              </div>

              <div className="d-flex flex-column gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="d-inline-flex align-items-center justify-content-center gap-2"
                  disabled={busy}
                  onClick={() => quickGoogleLogin("student")}
                >
                  <FontAwesomeIcon icon={faGoogle} style={{ color: "#0066cc" }} />
                  <span>⚡ Đăng nhập nhanh Google (Sinh viên DTU)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="d-inline-flex align-items-center justify-content-center gap-2"
                  disabled={busy}
                  onClick={() => quickGoogleLogin("admin")}
                  style={{ borderColor: "#c92c40", color: "#c92c40" }}
                >
                  <FontAwesomeIcon icon={faGoogle} style={{ color: "#c92c40" }} />
                  <span>⚡ Đăng nhập nhanh Google (Quản trị viên DTU)</span>
                </Button>
              </div>
            </div>
          )}
          <ButtonLink href={register || reset ? routes.login : routes.register}>
            {register || reset
              ? "Đã có tài khoản? Đăng nhập"
              : "Chưa có tài khoản? Đăng ký"}
          </ButtonLink>
          <div className="login-divider" />
          <small className="caption">
            Nội dung hội thoại được lưu trong tài khoản để bạn xem lại.
          </small>
        </form>}
      </div>
    </main>
  );
}

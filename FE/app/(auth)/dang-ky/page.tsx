import { connection } from "next/server";
import { ScreenPage } from "@/components/screen-page";
import { LoginPage } from "@/features/auth/login-page";
import { publicAuthConfig } from "@/lib/server-api";

export default async function Page() {
  // Đọc cấu hình Google từ môi trường khi có yêu cầu, không cố định lúc build Docker.
  await connection();
  const config = await publicAuthConfig();
  return (
    <ScreenPage screen="register">
      <LoginPage
        key="register"
        register
        googleEnabled={config.googleEnabled} otpEnabled={config.otpEnabled}
      />
    </ScreenPage>
  );
}

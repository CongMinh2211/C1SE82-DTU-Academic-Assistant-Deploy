import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ScreenPage } from "@/components/screen-page";
import { LoginPage } from "@/features/auth/login-page";
import { pageSession, publicAuthConfig } from "@/lib/server-api";
import { feedbackPath, validFeedbackId } from "@/lib/feedback-link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string | string[] }>;
}) {
  // Đọc cấu hình Google từ môi trường khi có yêu cầu, không cố định lúc build Docker.
  await connection();
  const feedbackId = validFeedbackId((await searchParams).feedback);
  // Google quay lại trang này sau xác thực; giữ đúng góp ý được mở từ email.
  if (feedbackId && await pageSession()) redirect(feedbackPath(feedbackId));
  const config = await publicAuthConfig();
  return (
    <ScreenPage screen="login">
      <LoginPage key="login" feedbackId={feedbackId} googleEnabled={config.googleEnabled} otpEnabled={config.otpEnabled} />
    </ScreenPage>
  );
}

import { ScreenPage } from "@/components/screen-page";
import { LoginPage } from "@/features/auth/login-page";

export default function Page() {
  return (
    <ScreenPage screen="resetPassword">
      <LoginPage key="resetPassword" reset />
    </ScreenPage>
  );
}

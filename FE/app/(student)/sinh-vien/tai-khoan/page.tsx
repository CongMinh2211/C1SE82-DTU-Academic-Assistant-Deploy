import { ScreenPage } from "@/components/screen-page";
import { ProfilePage } from "@/features/accounts/profile-page";

export default function Page() {
  return (
    <ScreenPage screen="profile">
      <ProfilePage />
    </ScreenPage>
  );
}

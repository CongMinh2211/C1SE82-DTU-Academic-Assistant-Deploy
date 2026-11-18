import { ScreenPage } from "@/components/screen-page";
import { SettingsPage } from "@/features/accounts/settings-page";

export default function Page() {
  return (
    <ScreenPage screen="settings">
      <SettingsPage />
    </ScreenPage>
  );
}

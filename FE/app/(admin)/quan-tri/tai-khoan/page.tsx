import { ScreenPage } from "@/components/screen-page";
import { UserManagement } from "@/features/accounts/user-management";

export default function Page() {
  return (
    <ScreenPage screen="users">
      <UserManagement />
    </ScreenPage>
  );
}

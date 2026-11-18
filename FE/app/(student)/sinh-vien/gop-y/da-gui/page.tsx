import { ScreenPage } from "@/components/screen-page";
import { FeedbackSent } from "@/features/feedback/sent";

export default function Page() {
  return (
    <ScreenPage screen="sent">
      <FeedbackSent />
    </ScreenPage>
  );
}

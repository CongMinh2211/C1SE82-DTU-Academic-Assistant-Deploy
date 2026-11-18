import { redirect } from "next/navigation";
import { ScreenPage } from "@/components/screen-page";
import { StudentFeedback } from "@/features/feedback/student-feedback";
import { pageSession } from "@/lib/server-api";
import { routes } from "@/lib/routes";
import { feedbackLoginPath, validFeedbackId } from "@/lib/feedback-link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string | string[] }>;
}) {
  const query = await searchParams;
  const feedbackId = validFeedbackId(query.feedback);
  if (query.feedback !== undefined && !feedbackId) redirect(routes.feedback);
  if (feedbackId && !(await pageSession())) redirect(feedbackLoginPath(feedbackId));
  return (
    <ScreenPage screen="feedback">
      <StudentFeedback />
    </ScreenPage>
  );
}

// Mục đích file: Hiển thị trạng thái sau khi sinh viên gửi góp ý.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import { useApp } from "@/components/app-provider";
import { useSearchParams } from "next/navigation";
import { routes } from "@/lib/routes";
import { useResource } from "@/lib/api-client";
import type { FeedbackRecord } from "@/lib/contracts";
import { ResourceState, Status } from "@/components/live-shared";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Heading,
  IconTile,
} from "@/components/ui";

export function FeedbackSent() {
  const { language } = useApp();
  const t = (text: string) => studentPageText(language, text);
  const params = useSearchParams(),
    resource = useResource<FeedbackRecord[]>("feedback");
  const found = resource.data?.find((f) => f.id === params.get("id"));
  return (
    <>
      <Heading
        title={t("Phản hồi của bạn")}
        description={t("Theo dõi trạng thái góp ý trong tài khoản.")}
      />
      <Card className="success-card">
        <ResourceState {...resource} retry={resource.refresh} language={language} />
        {found ? (
          <>
            <IconTile name="check" tone="teal" size={64} />
            <Badge tone="teal">{t("ĐÃ GHI NHẬN")}</Badge>
            <h2>{t("Cảm ơn bạn đã góp ý")}</h2>
            <p>{t("Góp ý đã được lưu để quản trị viên kiểm tra.")}</p>
            <Status value={found.status} language={language} />
            <p>{t("Mã phản hồi")}: {found.id}</p>
          </>
        ) : (
          !resource.loading && (
            <EmptyState>
              {t("Không tìm thấy phản hồi này trong tài khoản của bạn.")}
            </EmptyState>
          )
        )}
        <div className="row">
          <ButtonLink variant="primary" href={routes.chat}>
            {t("Tiếp tục hỏi trợ lý")}
          </ButtonLink>
          <ButtonLink href={routes.feedback}>{t("Xem góp ý đã gửi")}</ButtonLink>
        </div>
      </Card>
    </>
  );
}

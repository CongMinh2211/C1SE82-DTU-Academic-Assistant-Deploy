// Lưu lựa chọn nhận email theo tài khoản; không thay đổi email khôi phục mật khẩu.
"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Card } from "@/components/ui";
import { api, useResource } from "@/lib/api-client";
import { studentPageText } from "@/lib/student-page-text";

type NotificationPreferences = {
  feedback_email: boolean;
  email_available: boolean;
};

export function NotificationSettings() {
  const { language, notify } = useApp();
  const t = (value: string) => studentPageText(language, value);
  const resource = useResource<NotificationPreferences>("notification-preferences");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const preferences = resource.data;
  const enabled = preferences?.feedback_email ?? false;
  const unavailable = preferences?.email_available === false;
  const disabled = saving || !preferences || (unavailable && !enabled);

  async function toggleFeedbackEmail() {
    if (disabled) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api<NotificationPreferences>("notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ feedback_email: !enabled }),
      });
      resource.setData(updated);
      notify(t(updated.feedback_email ? "Đã bật email cập nhật phản hồi." : "Đã tắt email cập nhật phản hồi."));
    } catch {
      setSaveError("Không thể lưu cài đặt thông báo. Vui lòng thử lại.");
      // Đối chiếu lại khi mất kết nối sau khi máy chủ có thể đã lưu lựa chọn.
      await resource.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="account-card settings-card settings-panel">
      <h2>{t("Thông báo")}</h2>
      <p className="muted">{t("Chọn email bạn muốn nhận từ trợ lý học vụ.")}</p>
      <div className="settings-feature-list">
        <div className="settings-feature-row">
          <div>
            <strong>{t("Email khôi phục mật khẩu")}</strong>
            <p>{t("Gửi mã xác minh khi bạn yêu cầu lấy lại mật khẩu.")}</p>
          </div>
          <span className="settings-status">{t("Theo yêu cầu")}</span>
        </div>
        <div className="settings-feature-row" aria-busy={saving || resource.loading}>
          <div>
            <strong id="feedback-email-label">{t("Email cập nhật phản hồi")}</strong>
            <p id="feedback-email-help">{t("Nhận email khi quản trị viên xử lý góp ý của bạn. Email dẫn về ứng dụng để xem kết quả.")}</p>
          </div>
          <div className="notification-toggle-control">
            <span aria-hidden="true">{preferences ? t(enabled ? "Bật" : "Tắt") : "—"}</span>
            <button
              type="button"
              role="switch"
              className="notification-toggle"
              aria-checked={enabled}
              aria-labelledby="feedback-email-label"
              aria-describedby="feedback-email-help notification-preferences-note"
              disabled={disabled}
              onClick={() => void toggleFeedbackEmail()}
            >
              <span />
            </button>
          </div>
        </div>
      </div>
      {resource.loading && <p role="status">{t("Đang tải cài đặt thông báo…")}</p>}
      {saving && <p role="status">{t("Đang lưu…")}</p>}
      {resource.error && <div className="resource-error" role="alert">
        <p>{t("Không thể tải cài đặt thông báo. Vui lòng thử lại.")}</p>
        <Button variant="outline" onClick={() => void resource.refresh()}>{t("Thử lại")}</Button>
      </div>}
      {saveError && <p role="alert" className="form-error">{t(saveError)}</p>}
      {unavailable && <p className="settings-info">{t("Dịch vụ email hiện chưa khả dụng. Bạn vẫn có thể tắt email cập nhật phản hồi.")}</p>}
      <p className="settings-info" id="notification-preferences-note">{t("Lựa chọn được lưu theo tài khoản trên mọi thiết bị, áp dụng cho các góp ý được xử lý từ lúc bật. Email khôi phục mật khẩu vẫn chỉ gửi khi bạn yêu cầu.")}</p>
    </Card>
  );
}

// Mục đích file: Cung cấp trạng thái tải, lỗi và các thành phần dùng chung cho dữ liệu động.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import type { UiLanguage } from "@/lib/language";
import { statusLabels } from "@/lib/api-client";
import { Badge, Button } from "./ui";
export const topics = [
  "Đăng ký học phần",
  "Học phí",
  "Điểm số",
  "Tốt nghiệp",
  "Thủ tục",
];
export function ResourceState({
  loading,
  error,
  retry,
  language = "vi",
}: {
  loading: boolean;
  error: string;
  retry?: () => void;
  language?: UiLanguage;
}) {
  // Ưu tiên báo lỗi và chỉ hiện nút thử lại khi nơi gọi cung cấp hàm retry.
  if (error)
    return (
      <div className="resource-error" role="alert">
        <p>{error}</p>
        {retry && (
          <Button variant="outline" onClick={retry}>
            {studentPageText(language, "Thử lại")}
          </Button>
        )}
      </div>
    );
  return loading ? (
    <p className="loading-state" role="status">
      {studentPageText(language, "Đang tải dữ liệu…")}
    </p>
  ) : null;
}
// Ánh xạ nhóm trạng thái sang màu; giá trị chưa có nhãn vẫn được hiển thị nguyên văn.
export function Status({ value, language = "vi" }: { value: string; language?: UiLanguage }) {
  return (
    <Badge
      tone={
        ["published", "answered", "conversation", "done", "resolved"].includes(
          value,
        )
          ? "teal"
          : ["error", "failed"].includes(value)
            ? "red"
            : "amber"
      }
    >
      {studentPageText(language, statusLabels[value] || value)}
    </Badge>
  );
}

// Mục đích file: Cung cấp các điều khiển dùng chung cho màn hình quản trị.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import type { UiLanguage } from "@/lib/language";
import { useState } from "react";
import { Button } from "./ui";
import { useApp } from "./app-provider";

export function AdminPagination({
  total,
  page,
  pageSize = 10,
  onChange,
}: {
  total: number;
  page: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  // Luôn có ít nhất một trang; chặn trang hiện tại nếu số kết quả vừa giảm.
  const pages = Math.max(1, Math.ceil(total / pageSize)),
    current = Math.min(page, pages);
  return (
    <div className="admin-pagination">
      <small role="status">
        {total ? (current - 1) * pageSize + 1 : 0}–
        {Math.min(current * pageSize, total)} / {total} kết quả
      </small>
      <div className="row">
        <Button
          variant="outline"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          Trước
        </Button>
        <span>
          Trang {current}/{pages}
        </span>
        <Button
          variant="outline"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
export function ConfirmAdminAction({
  children,
  confirmLabel,
  onConfirm,
  language = "vi",
}: {
  children: React.ReactNode;
  confirmLabel: string;
  language?: UiLanguage;
  onConfirm: () => Promise<void>;
}) {
  const { closeModal } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="stack">
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              closeModal();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? studentPageText(language, "Đang xử lý…") : confirmLabel}
        </Button>
        <Button
          variant="outline"
          autoFocus
          disabled={busy}
          onClick={closeModal}
        >
          {studentPageText(language, "Hủy")}
        </Button>
      </div>
    </div>
  );
}

// Mục đích file: Hiển thị nội dung phiên bản để quản trị viên xem trước khi duyệt.
"use client";
import { useState } from "react";
import { api, useResource, dateText } from "@/lib/api-client";
import type { DocumentRecord } from "@/lib/contracts";
import { ResourceState } from "@/components/live-shared";
import { Button, Select } from "@/components/ui";

export function RevisionPreview({ revisionId }: { revisionId: string }) {
  // Lấy văn bản đã trích xuất của phiên bản để quản trị viên đối chiếu theo từng trang.
  const r = useResource<{
    title_snapshot: string;
    mime: string;
    pages: { page: number; text: string; ocr?: boolean }[];
  }>(`admin/revision/${revisionId}`);
  return (
    <>
      <ResourceState {...r} retry={r.refresh} />
      <h3>{r.data?.title_snapshot}</h3>
      {r.data?.pages.map((p) => (
        <section key={p.page}>
          <h4>{r.data?.mime === "application/pdf" ? `Trang ${p.page}` : "Nội dung tài liệu (không định vị trang)"}</h4>
          {p.ocr && <p role="note">Nội dung có nhận diện từ ảnh (OCR); hãy đối chiếu bản gốc trước khi duyệt.</p>}
          <pre className="source-page">{p.text}</pre>
        </section>
      ))}
    </>
  );
}

export function DocumentVersions({ document }: { document: DocumentRecord }) {
  // Lấy toàn bộ phiên bản và mặc định chọn phiên bản mới nhất của tài liệu.
  const r = useResource<{
    revisions: {
      id: string;
      version: number;
      status: string;
      created_at: string;
      published_at: string | null;
      issued_on: string | null; effective_from: string | null; effective_until: string | null; scope_key: string | null;
    }[];
  }>(`admin/documents/${document.id}`);
  const [selected, setSelected] = useState(document.latest_revision);
  const [validityMessage, setValidityMessage] = useState("");
  return (
    <div className="stack">
      <p className="muted">{document.scope}</p>
      <ResourceState {...r} retry={r.refresh} />
      <label className="field">
        <span>Phiên bản cần kiểm tra</span>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {r.data?.revisions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.version} ·{" "}
              {version.id === document.active_revision
                ? "Đang phục vụ"
                : version.status === "ready"
                  ? "Chờ duyệt"
                  : version.status}{" "}
              · {dateText(version.created_at)}
            </option>
          ))}
        </Select>
      </label>
      {r.data?.revisions.filter((version) => version.id === selected).map((version) => (
        <form key={version.id} className="stack" onSubmit={async (event) => {
          event.preventDefault();
          if (!window.confirm("Cập nhật thông tin hiệu lực có thể thay đổi nguồn chatbot sử dụng. Bạn chắc chắn muốn lưu?")) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          try {
            await api(`admin/revisions/${version.id}/validity`, {method:"PATCH", body:JSON.stringify(Object.fromEntries(data))});
            setValidityMessage("Đã lưu thông tin hiệu lực.");
            await r.refresh();
          } catch (error) { setValidityMessage((error as Error).message); }
        }}>
          <h3>Thông tin hiệu lực</h3>
          <p>Chỉ nhập sau khi đối chiếu nguồn gốc. Mã nhóm chỉ dùng chung cho cùng chủ đề, đối tượng và phạm vi. Để trống nếu chưa xác minh.</p>
          <label>Ngày ban hành <input className="input" type="date" name="issuedOn" defaultValue={version.issued_on || ""}/></label>
          <label>Ngày bắt đầu hiệu lực <input className="input" type="date" name="effectiveFrom" defaultValue={version.effective_from || ""}/></label>
          <label>Ngày kết thúc hiệu lực <input className="input" type="date" name="effectiveUntil" defaultValue={version.effective_until || ""}/></label>
          <label>Mã nhóm cùng phạm vi <input className="input" name="scopeKey" maxLength={120} defaultValue={version.scope_key || ""}/></label>
          <Button type="submit">Lưu thông tin hiệu lực</Button>
          {validityMessage && <p role="status">{validityMessage}</p>}
        </form>
      ))}
      <RevisionPreview key={selected} revisionId={selected} />
    </div>
  );
}

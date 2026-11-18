// Mục đích file: Nhận file hoặc URL nguồn và gửi yêu cầu thêm tài liệu tới máy chủ.
"use client";
import { CrawlSchedules } from "./crawl-schedules";
import { upload } from "@vercel/blob/client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useResource } from "@/lib/api-client";
import type { DocumentRecord } from "@/lib/contracts";
import { routes } from "@/lib/routes";
import { topics, ResourceState } from "@/components/live-shared";
import {
  Button,
  ButtonLink,
  Card,
  Heading,
  Notice,
  Select,
} from "@/components/ui";

export function AddSource() {
  const params = useSearchParams(),
    docId = params.get("doc"),
    r = useResource<{ document: DocumentRecord }>(
      docId ? `admin/documents/${docId}` : null,
    ),
    router = useRouter();
  const [kind, setKind] = useState("file"),
    [busy, setBusy] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    // Thu thập thông tin biểu mẫu và đưa giao diện vào trạng thái đang gửi.
    e.preventDefault();
    setBusy(true);
    setUploadProgress(null);
    setError("");
    const form = new FormData(e.currentTarget);
    if (docId) form.set("documentId", docId);
    try {
      if (kind === "file") {
        const config = await api<{ direct: boolean }>("admin/upload-config");
        if (config.direct) {
          // Trên cloud, xin quyền upload trước rồi gửi file trực tiếp vào kho riêng tư.
          const file = form.get("file");
          if (!(file instanceof File) || !file.size)
            throw new Error("Chưa chọn tài liệu.");
          if (file.size > 20 * 1024 * 1024)
            throw new Error("File lớn hơn 20 MB.");
          const fields = Object.fromEntries(
            [...form].filter(([key]) => key !== "file"),
          );
          const grant = await api<{
            id: string;
            pathname: string;
            contentType: string;
          }>("admin/uploads/start", {
            method: "POST",
            body: JSON.stringify({ ...fields, filename: file.name }),
          });
          await upload(grant.pathname, file, {
            access: "private",
            handleUploadUrl: "/api/uploads",
            clientPayload: grant.id,
            contentType: grant.contentType,
            abortSignal: AbortSignal.timeout(120000),
            onUploadProgress: ({ percentage }) =>
              setUploadProgress(Math.round(percentage)),
          });
          await api("admin/uploads/complete", {
            method: "POST",
            body: JSON.stringify({ id: grant.id }),
          });
        } else
          // Bản local gửi file qua API để hệ thống tạo phiên bản và hàng đợi xử lý.
          await api("admin/documents/upload", { method: "POST", body: form });
      } else
        // URL được kiểm tra tại máy chủ trước khi thu thập nội dung.
        await api("admin/documents/url", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(form)),
        });
      // Sang màn hình lập chỉ mục để theo dõi kết quả; tải lên chưa đồng nghĩa xuất bản.
      router.push(routes.indexing);
    } catch (e) {
      setError(
        e instanceof Error && /fetch|network|timeout|abort/i.test(e.message)
          ? "Không thể tải tài liệu lên lúc này. Kiểm tra kết nối rồi thử lại; tài liệu chưa được xuất bản."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  if (docId && !r.data) return <ResourceState {...r} retry={r.refresh} />;
  const d = r.data?.document;
  return (
    <>
      <Heading
        title={docId ? "Cập nhật phiên bản tài liệu" : "Thêm nguồn tài liệu"}
        description="Giữ rõ nguồn gốc, thời điểm và đối tượng áp dụng của tài liệu."
      />
      <div className="two-columns">
        <Card>
          <div className="tabs">
            <button
              aria-pressed={kind === "file"}
              onClick={() => setKind("file")}
            >
              Tải tệp PDF / Word / TXT / Markdown
            </button>
            <button
              aria-pressed={kind === "url"}
              onClick={() => setKind("url")}
            >
              Thu thập từ URL DTU
            </button>
          </div>
          <form className="stack" onSubmit={submit}>
            <label className="field">
              <span>Tên tài liệu</span>
              <input
                className="input"
                name="title"
                minLength={5}
                maxLength={250}
                defaultValue={d?.title}
                required
              />
            </label>
            <label className="field">
              <span>Chủ đề</span>
              <Select name="topic" defaultValue={d?.topic || topics[0]}>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>Phạm vi áp dụng</span>
              <textarea
                className="input"
                name="scope"
                rows={4}
                minLength={10}
                maxLength={1500}
                defaultValue={d?.scope}
                placeholder="Khóa, ngành/chương trình, học kỳ, năm học, đợt áp dụng và điều kiện chuyển tiếp…"
                required
              />
            </label>
            <fieldset className="stack">
              <legend>Ngày và nhóm phạm vi (nếu đã xác minh)</legend>
              <label className="field"><span>Ngày ban hành</span><input className="input" type="date" name="issuedOn" /></label>
              <label className="field"><span>Ngày bắt đầu hiệu lực</span><input className="input" type="date" name="effectiveFrom" /></label>
              <label className="field"><span>Ngày kết thúc hiệu lực</span><input className="input" type="date" name="effectiveUntil" /></label>
              <label className="field"><span>Mã nhóm cùng phạm vi</span><input className="input" name="scopeKey" maxLength={120} placeholder="Ví dụ: hoc-phi-k29-cmu-102" /></label>
              <small>Chỉ dùng cùng mã nhóm cho tài liệu cùng chủ đề, đối tượng và phạm vi. Để trống nếu chưa xác minh.</small>
            </fieldset>
            {kind === "file" && (
              <label className="field">
                <span>Liên kết nguồn DTU gốc (nếu có)</span>
                <input
                  className="input"
                  name="url"
                  type="url"
                  maxLength={2048}
                  defaultValue={d?.source_url || ""}
                  placeholder="https://duytan.edu.vn/…"
                />
              </label>
            )}
            {kind === "file" ? (
              <label className="field upload-zone">
                <span>Chọn tài liệu (tối đa 20 MB)</span>
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  required
                />
                <small>
                  PDF, DOCX, TXT hoặc Markdown (.md, .markdown) UTF-8. Sau khi xử lý cần kiểm tra và xuất bản thì trợ lý mới tra cứu. Markdown không có số trang cố định. Trang PDF scan và ảnh trong DOCX được OCR khi máy chủ hỗ trợ; nội dung nhận diện cần rà soát. DOCX chưa có trích dẫn theo trang.
                </small>
              </label>
            ) : (
              <label className="field">
                <span>URL HTTPS nguồn chính thức của DTU</span>
                <input
                  className="input"
                  name="url"
                  type="url"
                  defaultValue={d?.source_url || ""}
                  placeholder="https://duytan.edu.vn/…"
                  required
                />
                <small>
                  Hệ thống lấy nội dung của một URL, lập chỉ mục nền và chờ quản
                  trị viên duyệt trước khi xuất bản.
                </small>
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <Button type="submit" disabled={busy}>
                {busy
                  ? uploadProgress === null
                    ? "Đang chuẩn bị…"
                    : uploadProgress < 100
                      ? `Đang tải ${uploadProgress}%…`
                      : "Đang lưu nguồn…"
                  : "Lưu và lập chỉ mục"}
              </Button>
              <ButtonLink href={routes.documents}>Hủy</ButtonLink>
            </div>
          </form>
        </Card>
        <Card>
          <h2>Trước khi thêm nguồn</h2>
          <ol className="guidance-list">
            <li>Kiểm tra tài liệu gốc và tính đầy đủ của các trang.</li>
            <li>Ghi rõ thời kỳ, khóa và nhóm sinh viên áp dụng.</li>
            <li>Rà soát nội dung đã trích xuất sau khi lập chỉ mục.</li>
            <li>Xuất bản phiên bản đã kiểm tra để trợ lý sử dụng.</li>
          </ol>
          <Notice title="Phiên bản đang dùng vẫn được giữ">
            Nội dung mới chưa ảnh hưởng tới câu trả lời cho tới khi được xuất
            bản.
          </Notice>
        </Card>
      </div>
      {!docId && <CrawlSchedules />}
    </>
  );
}

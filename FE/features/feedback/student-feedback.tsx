// Mục đích file: Hiển thị biểu mẫu đánh giá để sinh viên gửi nhận xét về câu trả lời.
"use client";
import { studentPageText } from "@/lib/student-page-text";
import { useApp } from "@/components/app-provider";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/lib/routes";
import { api, useResource, dateText } from "@/lib/api-client";
import type { FeedbackRecord } from "@/lib/contracts";
import { ResourceState, Status } from "@/components/live-shared";
import { Button, ButtonLink, Card, EmptyState, Heading, Select } from "@/components/ui";

export function StudentFeedback() {
  const { language } = useApp();
  const t = (text: string) => studentPageText(language, text);
  const params = useSearchParams(),
    router = useRouter();
  const [rating, setRating] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const feedbackId = params.get("feedback");
  const previous = useResource<FeedbackRecord[]>(feedbackId ? null : "feedback");
  const selectedFeedback = useResource<FeedbackRecord>(feedbackId ? `feedback/${encodeURIComponent(feedbackId)}` : null);
  const feedbackResource = feedbackId ? selectedFeedback : previous;
  // Liên kết email mở đúng góp ý, kể cả khi không nằm trong năm mục gần nhất.
  const feedbackItems = feedbackId
    ? (selectedFeedback.data ? [selectedFeedback.data] : [])
    : (previous.data?.slice(0, 5) || []);
  // Nếu góp ý từ một câu trả lời, lấy ngữ cảnh để sinh viên biết mình đang đánh giá nội dung nào.
  const messageId = params.get("message");
  const context = useResource<{ question: string | null; answer: string }>(
    messageId ? `feedback/context/${encodeURIComponent(messageId)}` : null,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    // Kiểm tra đã chọn mức đánh giá trước khi gửi biểu mẫu.
    e.preventDefault();
    setError("");
    if (!rating) {
      setError(t("Vui lòng chọn mức đánh giá."));
      return;
    }
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      // Gửi ID câu trả lời nếu có; API kiểm tra câu trả lời đó thuộc người dùng hiện tại.
      const result = await api<{ id: string }>("feedback", {
        method: "POST",
        body: JSON.stringify({
          ...(params.get("message")
            ? { messageId: params.get("message") }
            : {}),
          rating,
          category: data.get("category"),
          content: data.get("content"),
        }),
      });
      router.push(`${routes.sent}?id=${result.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={t("Góp ý để trợ lý tốt hơn")}
        description={t("Phản hồi được lưu và chuyển tới quản trị viên để xem xét.")}
      />
      <div className="two-columns">
        <Card>
          <form className="stack" onSubmit={submit}>
            <h2>{t("Chia sẻ trải nghiệm của bạn")}</h2>
            {messageId && (
              <section aria-label={t("Câu hỏi và câu trả lời được góp ý")}>
                <ResourceState {...context} retry={context.refresh} language={language} />
                {context.data && (
                  <>
                    <h3>{t("Câu hỏi của bạn")}</h3>
                    <p>
                      {context.data.question ||
                        t("Không tìm thấy câu hỏi trước đó.")}
                    </p>
                    <h3>{t("Câu trả lời được chọn")}</h3>
                    <p>{context.data.answer}</p>
                  </>
                )}
              </section>
            )}
            <fieldset className="rating-field">
              <legend>{t("Đánh giá của bạn")}</legend>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-label={`${n} ${language === "en" ? "stars" : language === "hi" ? "सितारे" : "sao"}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(n)}
                    className={rating >= n ? "selected" : ""}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span>{t("Loại phản hồi")}</span>
              <Select name="category">
                <option value="Nội dung câu trả lời">{t("Nội dung câu trả lời")}</option>
                <option value="Nguồn trích dẫn">{t("Nguồn trích dẫn")}</option>
                <option value="Thiếu thông tin">{t("Thiếu thông tin")}</option>
                <option value="Trải nghiệm ứng dụng">{t("Trải nghiệm ứng dụng")}</option>
              </Select>
            </label>
            <label className="field">
              <span>{t("Nội dung góp ý")}</span>
              <textarea
                className="input"
                name="content"
                rows={6}
                minLength={5}
                maxLength={3000}
                required
                placeholder={t("Mô tả điểm cần kiểm tra hoặc điều bạn thấy hữu ích…")}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? t("Đang gửi…") : t("Gửi góp ý")}
            </Button>
          </form>
        </Card>
        <Card>
          <h2>{t("Góp ý đã gửi")}</h2>
          <ResourceState {...feedbackResource} retry={feedbackResource.refresh} language={language} />
          {feedbackItems.map((f) => (
            <article className="feedback-record" key={f.id}>
              <Status value={f.status} language={language} />
              <p>{f.content}</p>
              <small>
                {f.rating}/5 {language === "en" ? "stars" : language === "hi" ? "सितारे" : "sao"} • {dateText(f.created_at)}
              </small>
              {f.resolution && (
                <p className="resolution">
                  {t("Phản hồi từ quản trị")}: {f.resolution}
                </p>
              )}
            </article>
          ))}
          {!feedbackId && previous.data?.length === 0 && (
            <EmptyState>{t("Bạn chưa gửi phản hồi nào.")}</EmptyState>
          )}
          {feedbackId && <ButtonLink href={routes.feedback}>{t("Xem góp ý đã gửi")}</ButtonLink>}
        </Card>
      </div>
    </>
  );
}

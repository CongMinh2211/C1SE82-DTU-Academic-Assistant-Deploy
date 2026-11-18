// Mục đích file: Hiển thị câu trả lời, trích dẫn, liên kết và thao tác sao chép hoặc góp ý.
"use client";
import Link from "next/link";
import { studentPageText } from "@/lib/student-page-text";
import { routes } from "@/lib/routes";
import type { Message } from "@/lib/contracts";
import { useApp } from "@/components/app-provider";
import { Status } from "@/components/live-shared";
import { isGoogleMapsLink } from "@/lib/map-link";

export function AnswerBubble({
  message,
  question,
  onShowSources,
  onRetry,
  busy,
  documentOnly = false,
}: {
  message: Message;
  question: string;
  onShowSources: () => void;
  onRetry?: () => void;
  busy: boolean;
  documentOnly?: boolean;
}) {
  const { notify, language } = useApp();
  const t = (value: string) => studentPageText(language, value);
  // Chỉ gợi ý khoa khi người dùng nêu rõ tên khoa; không đoán từ tên giảng viên.
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const english = !/[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/i.test(question) &&
    !/\b(?:ban|minh|em|toi|hoc|giup|khoa|nam hoc|diem)\b/.test(normalized) &&
    /\b(?:what|how|can|when|where|is|are|tuition|graduation|please|my|help|do|exam|schedule)\b/.test(normalized);
  const departments = [
    { key:"khoa dao tao quoc te", name:"Khoa Đào tạo Quốc tế", phone:"0236 710 9922 (máy lẻ 137)", tel:"02367109922", url:"https://is.duytan.edu.vn/contact" },
    { key:"khoa duoc", name:"Khoa Dược", phone:"0236 710 9922 (máy lẻ 302)", tel:"02367109922", url:"https://cmp.duytan.edu.vn/khoa-duoc-1ea/gioi-thieu-khoa-duoc-x2s" },
    { key:"khoa kien truc", name:"Khoa Kiến trúc", phone:"0236 382 7111 (máy lẻ 203)", tel:"02363827111", url:"https://kkientruc.duytan.edu.vn/lien-he/" },
    { key:"khoa kinh te tai chinh", name:"Khoa Kinh tế - Tài chính", phone:"0236 365 0403 (máy lẻ 129/405)", tel:"02363650403", url:"https://kkttc.duytan.edu.vn/contact" },
    { key:"khoa tieng trung", name:"Khoa Tiếng Trung", phone:"0236 365 0403 (máy lẻ 621)", tel:"02363650403", url:"https://ktiengtrung.duytan.edu.vn/contact" },
  ].filter((item) => normalized.includes(item.key));
  const department = departments.length === 1 ? departments[0] : null;
  // Tập ID cho phép xác định dấu [n] nào thực sự có nguồn trong câu trả lời.
  const cited = new Set(message.citations.map((c) => c.id));
  // Tách văn bản thành các đoạn thường, số trích dẫn và URL để xử lý từng loại.
  const parts = message.content.split(/(\[\d+\]|https:\/\/[^\s<>]+)/g);
  return (
    <div
      className={`answer-bubble ${message.status === "insufficient" ? "fallback-answer" : ""}`}
    >
      <Status value={message.status} language={language} />
      <div className="answer-text">
        {message.content
          ? parts.map((part, i) => {
              // Chỉ biến số trích dẫn có thật thành liên kết xem nguồn.
              const id = part.match(/^\[(\d+)\]$/)?.[1];
              // Bỏ dấu câu cuối URL khi kiểm tra; chỉ tạo link nếu URL thuộc nguồn đã trích.
              const link = part.replace(/[.,;!?]+$/, "");
              // Chỉ cho phép đường dẫn bản đồ do hệ thống tạo với đích cụ thể, không mở URL lạ.
              if (isGoogleMapsLink(link))
                return <a className="answer-map-link" key={i} href={link} target="_blank" rel="noopener noreferrer">{t("Xem bản đồ ↗")}</a>;
              if (link.startsWith("https://") && message.citations.some((c) => c.url === link))
                return <a key={i} href={link} target="_blank" rel="noopener noreferrer">{link}{part.slice(link.length)}</a>;
              return id && cited.has(id) ? (
                <Link
                  className="inline-citation"
                  aria-label={`Xem nguồn ${id}`}
                  href={`${routes.source}?message=${message.id}&citation=${id}`}
                  key={i}
                >
                  {part}
                </Link>
              ) : (
                part
              );
            })
          : "Yêu cầu đang được xử lý. Bạn có thể kiểm tra lại trong lịch sử."}
      </div>
      {message.status === "insufficient" && !documentOnly && (
        <div className="answer-text">
          {english ? <p>For confirmation, contact DTU Academic Affairs: <a href="tel:02362243775">0236 224 3775</a>, <a href="mailto:bandaotao@duytan.edu.vn">bandaotao@duytan.edu.vn</a>, or your academic advisor. <a href="https://duytan.edu.vn/ContactUs" target="_blank" rel="noreferrer">Official DTU contact directory ↗</a></p> : department ? <p>Để xác nhận, bạn có thể liên hệ <a href={department.url} target="_blank" rel="noreferrer">{department.name}</a>: <a href={`tel:${department.tel}`}>{department.phone}</a> hoặc cố vấn học tập.</p> : <>
          <p>Nếu cần xác nhận, bạn có thể liên hệ:</p>
          <p>
            Ban Đào tạo: K7/25 Quang Trung, Đà Nẵng. Điện thoại:{" "}
            <a href="tel:02362243775">0236 2 243 775</a>; email:{" "}
            <a href="mailto:bandaotao@duytan.edu.vn">bandaotao@duytan.edu.vn</a>
            . Thông tin liên hệ theo{" "}
            <a
              href="https://duytan.edu.vn/ContactUs"
              target="_blank"
              rel="noreferrer"
            >
              danh bạ chính thức của DTU
            </a>
            .
          </p>
          <p>
            Bạn cũng có thể liên hệ cố vấn học tập hoặc văn phòng khoa của mình.
          </p>
          </>}
        </div>
      )}
      {message.citations.some((c) => c.url?.startsWith("https://")) && (
        <div className="answer-tools" aria-label="Liên kết nguồn">
          {message.citations
            .filter((c) => c.url?.startsWith("https://"))
            .map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Nguồn [{c.id}]: {c.title} ↗
              </a>
            ))}
        </div>
      )}
      {message.status !== "processing" && (
        <div className="answer-tools">
          <button
            type="button"
            onClick={async () => {
              // Sao chép nguyên văn câu trả lời và thông báo nếu trình duyệt từ chối quyền clipboard.
              try {
                await navigator.clipboard.writeText(message.content);
                notify(t("Đã sao chép câu trả lời."));
              } catch {
                notify(
                  "Trình duyệt không cho phép sao chép. Bạn có thể chọn và sao chép văn bản.",
                );
              }
            }}
          >
            {t("Sao chép")}
          </button>
          {message.status === "error" && onRetry && (
            <button type="button" onClick={onRetry} disabled={busy}>
              {t("Thử lại câu hỏi")}
            </button>
          )}
          {message.status !== "processing" && (
            <Link href={`${routes.feedback}?message=${message.id}`}>
              {t("Đánh giá / Góp ý")}
            </Link>
          )}
          {message.citations.length > 0 && (
            <button
              type="button"
              className="show-answer-sources"
              onClick={onShowSources}
            >
              {language === "en" ? `View ${message.citations.length} sources` : language === "hi" ? `${message.citations.length} स्रोत देखें` : `Xem ${message.citations.length} nguồn`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

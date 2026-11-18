// Mục đích file: Hiển thị FAQ đã xuất bản cho sinh viên tìm kiếm và xem nội dung.
"use client";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { useSearchParams } from "next/navigation";
import { routes } from "@/lib/routes";
import { useResource } from "@/lib/api-client";
import type { FaqRecord } from "@/lib/contracts";
import { faqMatches } from "@/lib/faq-search";
import { ResourceState, topics } from "@/components/live-shared";
import {
  Badge,
  ButtonLink,
  CampusImage,
  Card,
  EmptyState,
  Heading,
  Icon,
  Notice,
  SearchInput,
  Select,
} from "@/components/ui";

export function StudentFaq() {
  const { language } = useApp();
  const copy = {
    vi: ["FAQ & thủ tục sinh viên", "Nội dung do quản trị viên biên soạn, gắn với tài liệu nguồn.", "THƯ VIỆN HỌC VỤ", "Tìm nhanh điều bạn đang cần", "Kiểm tra đúng tài liệu áp dụng cho khóa và chương trình của bạn.", "Tìm câu hỏi hoặc thủ tục…", "Chủ đề FAQ", "Tất cả chủ đề", "Kiểm tra nguồn", "Hỏi trợ lý", "Chưa có FAQ đã xuất bản cho bộ lọc này. Hỏi trợ lý để tra cứu trực tiếp từ tài liệu.", "Cần giải thích cho trường hợp của bạn?", "Hỏi trợ lý theo khóa, chương trình và thời điểm cụ thể để tra cứu nguồn phù hợp.", "Nội dung quản trị biên soạn", "trang nguồn"],
    en: ["Student FAQs & procedures", "Content prepared by administrators and linked to source documents.", "ACADEMIC LIBRARY", "Find what you need", "Check documents applicable to your cohort and programme.", "Search questions or procedures…", "FAQ topic", "All topics", "View source", "Ask assistant", "No published FAQs match this filter. Ask the assistant to search the documents.", "Need help with your situation?", "Include your cohort, programme and time when asking the assistant.", "Prepared by administrators", "source page"],
    hi: ["छात्र प्रश्न और प्रक्रियाएँ", "प्रशासकों द्वारा तैयार और स्रोत दस्तावेज़ों से जुड़ी सामग्री।", "शैक्षणिक पुस्तकालय", "अपनी ज़रूरत की जानकारी खोजें", "अपने बैच और कार्यक्रम पर लागू दस्तावेज़ देखें।", "प्रश्न या प्रक्रिया खोजें…", "प्रश्न का विषय", "सभी विषय", "स्रोत देखें", "सहायक से पूछें", "इस फ़िल्टर के लिए कोई प्रकाशित प्रश्न नहीं है। दस्तावेज़ खोजने के लिए सहायक से पूछें।", "अपनी स्थिति के लिए सहायता चाहिए?", "सही स्रोत खोजने के लिए अपना बैच, कार्यक्रम और समय बताएँ।", "प्रशासकों द्वारा तैयार", "स्रोत पृष्ठ"],
  }[language];
  // Nạp FAQ dành cho sinh viên và nhận bộ lọc chủ đề tùy chọn từ đường dẫn.
  const params = useSearchParams(),
    resource = useResource<FaqRecord[]>("faqs");
  const [search, setSearch] = useState(""),
    [topic, setTopic] = useState(params.get("chu-de") || ""),
    [open, setOpen] = useState("");
  // Lọc kết hợp chủ đề và từ khóa trên câu hỏi, câu trả lời và tên nguồn.
  const filtered = (resource.data || []).filter(
    (f) =>
      (!topic || f.topic === topic) &&
      faqMatches(search, f.question, f.answer, f.topic, f.source_title),
  );
  return (
    <>
      <Heading
        title={copy[0]}
        description={copy[1]}
      />
      <section className="faq-banner">
        <div>
          <Badge>{copy[2]}</Badge>
          <h2>{copy[3]}</h2>
          <p>
            {copy[4]}
          </p>
        </div>
        <CampusImage variant="faq" />
      </section>
      <Card>
        <div className="filter-row">
          <SearchInput
            placeholder={copy[5]}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            aria-label={copy[6]}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">{copy[7]}</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <ResourceState {...resource} retry={resource.refresh} />
        {filtered.map((f) => (
          <article className="faq-item" key={f.id}>
            <button
              className="faq-question"
              aria-expanded={open === f.id}
              onClick={() => setOpen(open === f.id ? "" : f.id)}
            >
              <strong>{f.question}</strong>
              <Icon name="chevron" tone="muted" size={20} />
            </button>
            {open === f.id && (
              <div className="faq-answer">
                <p className="answer-text">{f.answer}</p>
                <small>
                  {copy[13]} • {f.source_title}, {copy[14]}{" "}
                  {f.page}
                </small>
                <div className="row">
                  <ButtonLink href={`${routes.source}?faq=${f.id}`}>
                    {copy[8]}
                  </ButtonLink>
                  <ButtonLink
                    href={`${routes.chat}?q=${encodeURIComponent(f.question)}`}
                  >
                    {copy[9]}
                  </ButtonLink>
                </div>
              </div>
            )}
          </article>
        ))}
        {!resource.loading && filtered.length === 0 && (
          <EmptyState>
            {copy[10]}
          </EmptyState>
        )}
      </Card>
      <Notice title={copy[11]}>
        {copy[12]}
      </Notice>
    </>
  );
}

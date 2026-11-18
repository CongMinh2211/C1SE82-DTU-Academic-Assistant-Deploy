import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import assets from "@/lib/figma-assets.json";
import { readConversationShare } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hội thoại được chia sẻ",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Chỉ biến URL có trong danh sách nguồn của câu trả lời thành liên kết có thể nhấn.
function SharedContent({ content, citations, index }: {
  content: string;
  citations: { id: string; url?: string }[];
  index: number;
}) {
  return content.split(/(\[\d+\]|https:\/\/[^\s<>]+)/g).map((part, i) => {
    const id = part.match(/^\[(\d+)\]$/)?.[1];
    const url = part.replace(/[.,;!?]+$/, "");
    if (id && citations.some((citation) => citation.id === id))
      return <a className="share-inline-citation" href={`#share-source-${index}-${id}`} key={i} aria-label={`Xem nguồn ${id}`}>{part}</a>;
    if (url.startsWith("https://") && citations.some((citation) => citation.url === url))
      return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{part.slice(url.length)}</span>;
    return part;
  });
}

export default async function SharedConversation({ params }: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Bản chia sẻ là ảnh chụp cố định, không đọc nội dung mới sau khi tạo liên kết.
  const snapshot = await readConversationShare(token);
  return (
    <div className="share-shell">
      <header className="share-header">
        <Link href="/" className="share-brand" aria-label="DTU Academic Assistant - Trang chủ">
          <Image src={assets.logo} alt="Đại học Duy Tân" width={130} height={40} unoptimized />
          <span className="share-brand-divider" aria-hidden="true" />
          <span>DTU <strong>Academic Assistant</strong></span>
        </Link>
        <Link href="/" className="share-header-link">Trang chủ <span aria-hidden="true">↗</span></Link>
      </header>
      <main className="share-page">
        {snapshot ? (
          <>
            <div className="share-intro">
              <span className="share-eyebrow"><span aria-hidden="true">✦</span> HỘI THOẠI ĐƯỢC CHIA SẺ</span>
              <h1>{snapshot.title}</h1>
              <p>Cùng xem lại cuộc trò chuyện với Trợ lý học vụ DTU.</p>
              <div className="share-notice"><span aria-hidden="true">ⓘ</span><span>Đây là bản chụp tại thời điểm chia sẻ. Nội dung sẽ không tự cập nhật.</span></div>
            </div>
            <section className="share-thread" aria-label="Nội dung hội thoại">
              <div className="share-thread-heading"><span>CUỘC TRÒ CHUYỆN</span><span>{snapshot.messages.length} tin nhắn</span></div>
              {snapshot.messages.map((m, i) => (
                <article className={`share-message ${m.role === "user" ? "share-message-user" : "share-message-assistant"}`} key={i}>
                  <div className="share-avatar" aria-hidden="true">{m.role === "user" ? "SV" : "✦"}</div>
                  <div className="share-message-body">
                    <div className="share-message-label"><strong>{m.role === "user" ? "Sinh viên" : "Trợ lý DTU"}</strong>{m.role !== "user" && <span>TRỢ LÝ HỌC VỤ</span>}</div>
                    <div className="share-message-content"><SharedContent content={m.content} citations={m.citations} index={i} /></div>
                    {m.citations.length > 0 && (
                      <div className="share-sources" aria-label="Nguồn tham khảo">
                        <div className="share-sources-heading">Nguồn tham khảo <span>{m.citations.length}</span></div>
                        {m.citations.map((c) => (
                          <div className="share-source" id={`share-source-${i}-${c.id}`} key={c.id}>
                            <span className="share-source-number">{c.id}</span>
                            <div><strong>{c.title}</strong>{c.page > 0 && <small>Trang {c.page}</small>}</div>
                            {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer">Xem nguồn <span aria-hidden="true">↗</span></a>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
            <div className="share-footer"><span>DTU ACADEMIC ASSISTANT</span><p>Thông tin học vụ rõ ràng, có nguồn để đối chiếu.</p><Link href="/">Tìm hiểu trợ lý <span aria-hidden="true">→</span></Link></div>
          </>
        ) : (
          <section className="share-unavailable"><div className="share-unavailable-icon" aria-hidden="true">↗</div><h1>Liên kết không khả dụng</h1><p>Liên kết đã hết hạn, bị thu hồi hoặc không tồn tại. Bạn hãy liên hệ người chia sẻ để nhận liên kết mới.</p><Link href="/">Về trang chủ →</Link></section>
        )}
      </main>
    </div>
  );
}

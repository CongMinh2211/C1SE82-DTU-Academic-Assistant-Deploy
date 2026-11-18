// Mục đích file: Hiển thị lời chào và FAQ đã duyệt khi người dùng chưa bắt đầu hội thoại.
import { useApp } from "@/components/app-provider";
import { studentCopy } from "@/lib/student-copy";
import { useResource } from "@/lib/api-client";
import Image from "next/image";
import type { FaqRecord } from "@/lib/contracts";
import { Icon } from "@/components/ui";
import type { ChatController } from "@/features/chat/hooks/use-chat-controller";

export function ChatWelcome({ send }: Pick<ChatController, "send">) {
  // Lấy FAQ từ API; API chỉ trả các mục đã công bố và còn nguồn hợp lệ.
  const { language } = useApp();
  const copy = studentCopy[language];
  const faqs = useResource<FaqRecord[]>("faqs");
  return (
    <div className="chat-welcome">
      <div className="chat-welcome-intro">
        <div className="chat-welcome-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2>{copy.welcome}</h2>
          <p>{copy.welcomeDesc}</p>
        </div>
        <Image className="chat-welcome-robot" src="/figma/dtu-assistant-mascot-chest.png" alt="" width={176} height={161} />
      </div>
      {faqs.loading && <p role="status">{copy.loadingFaq}</p>}
      {faqs.error && (
        <p>
          {copy.faqError}
        </p>
      )}
      <div className="chat-starters">
        {faqs.data?.slice(0, 4).map((faq) => (
          <button
            type="button"
            key={faq.id}
            onClick={() => void send(faq.question)}
          >
            <Icon name="help" size={20} />
            <span>{faq.question}</span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}

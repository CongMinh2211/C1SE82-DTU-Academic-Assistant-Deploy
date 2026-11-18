// Mục đích file: Nhận câu hỏi, xử lý nhập liệu và gửi yêu cầu từ khung chat.
import { useApp } from "@/components/app-provider";
import { studentCopy } from "@/lib/student-copy";
import { Button } from "@/components/ui";
import Image from "next/image";
import { VoiceInput } from "@/components/voice-input";

import type { ChatController } from "@/features/chat/hooks/use-chat-controller";
export function ChatComposer({
  input,
  textarea,
  setInput,
  send,
  busy,
  web,
  onWebChange,
  voiceMode = false,
}: Pick<
  ChatController,
  "input" | "textarea" | "setInput" | "send" | "busy"
> & { web: boolean; onWebChange: (value: boolean) => void; voiceMode?: boolean }) {
  const { language } = useApp();
  const copy = studentCopy[language];
  // Giao diện nhận nội dung; controller chịu trách nhiệm gọi API và quản lý trạng thái.
  return (
    <div className="composer-area">
      <div className="question-prompt"><Image src="/figma/dtu-logo.png" alt="" width={25} height={25} /><span>{copy.prompt}</span><span className="pointing-hand" aria-hidden="true">👇</span></div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          // Ngăn tải lại trang và chuyển nội dung tới hàm gửi câu hỏi.
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={textarea}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter gửi, Shift+Enter xuống dòng; không gửi khi bộ gõ đang ghép chữ.
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send(input);
            }
          }}
          aria-label={copy.nextQuestion}
          placeholder={busy ? copy.waiting : copy.placeholder}
          maxLength={2500}
          disabled={busy}
          required
        />
        {!voiceMode && <VoiceInput value={input} disabled={busy} onChange={setInput} />}
        <Button
          type="submit"
          aria-label={copy.send}
          // Không cho gửi câu hỏi trống hoặc gửi thêm khi yêu cầu đang chạy.
          disabled={busy || !input.trim()}
        >
          <span>{busy ? copy.sending : copy.send}</span>
          {!busy && <span aria-hidden="true">↑</span>}
        </Button>
      </form>
      <div className="composer-meta">
        {busy && <span role="status" className="composer-wait-status">{copy.waitDesc}</span>}
        {voiceMode ? <small>Chỉ dùng tài liệu đã duyệt</small> : <label className="web-toggle">
          <input
            type="checkbox"
            checked={web}
            // Báo cho controller biết người dùng có cho phép tìm thêm nguồn web.
            onChange={(e) => onWebChange(e.target.checked)}
            disabled={busy}
          />{" "}
          {copy.web}
        </label>}
        <small className="input-counter" aria-live="off">
          {input.length > 2000 ? `${input.length}/2500` : ""}
        </small>
      </div>
    </div>
  );
}

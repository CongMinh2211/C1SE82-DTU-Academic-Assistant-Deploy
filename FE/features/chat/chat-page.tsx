// Mục đích file: Ghép các thành phần màn hình chat, điều khiển hỏi đáp và thao tác chia sẻ.
"use client";
import { useChatController } from "@/features/chat/hooks/use-chat-controller";
import { ChatWelcome } from "@/features/chat/components/welcome";
import { ChatMessages } from "@/features/chat/components/messages";
import { ChatFollowUps } from "@/features/chat/components/follow-ups";
import { ChatComposer } from "@/features/chat/components/composer";
import { VoiceMode } from "@/features/chat/components/voice-mode";
import { useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { routes } from "@/lib/routes";
import { api } from "@/lib/api-client";
import { useApp } from "@/components/app-provider";
import { studentCopy } from "@/lib/student-copy";
import { ConfirmAdminAction } from "@/components/admin-controls";

import { ResourceState } from "@/components/live-shared";
import { Button, Card, Heading } from "@/components/ui";

import { Sources } from "@/features/chat/components/sources";

export function ChatPage() {
  // Tạo vùng chat theo hội thoại hoặc câu hỏi được chuyển từ trang khác.
  const params = useSearchParams();
  const [web, setWeb] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceRequestId, setVoiceRequestId] = useState<string | null>(null);
  return (
    <ChatView
      key={`${params.get("c") || "new"}:${params.get("q") || ""}`}
      web={web}
      onWebChange={setWeb}
      voiceMode={voiceMode}
      onVoiceModeChange={setVoiceMode}
      voiceRequestId={voiceRequestId}
      onVoiceRequest={setVoiceRequestId}
    />
  );
}

function ChatView({
  web,
  onWebChange,
  voiceMode, onVoiceModeChange, voiceRequestId, onVoiceRequest,
}: {
  web: boolean;
  onWebChange: (value: boolean) => void;
  voiceMode: boolean; onVoiceModeChange: (value: boolean) => void;
  voiceRequestId: string | null; onVoiceRequest: (id: string | null) => void;
}) {
  const { notify, showModal, language } = useApp();
  const copy = studentCopy[language];
  const {
    cid,
    resource,
    conversation,
    busy,
    pending,
    sourceAnswer,
    sourceReveal,
    sourceQuestion,
    input,
    textarea,
    setInput,
    draftKey,
    send,
    controller,
    bottom,
    lastAnswer,
    lastQuestion,
    setLocal,
    setError,
    error,
    router,
    exportChat,
    setSourceMessageId,
    setSourceReveal,
  } = useChatController(web, voiceMode, onVoiceRequest);
  function editDraft(value: string) {
    setInput(value);
    try { sessionStorage.setItem(draftKey, value); } catch {}
  }
  return (
    <>
      <Heading
        title={copy.chatTitle}
        description={copy.chatDesc}
        action={
          <div className="heading-actions">
            {conversation && (
              <>
                <Button variant="outline" onClick={exportChat} disabled={busy}>
                  {copy.export}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    // Chỉ tạo liên kết sau khi người dùng đồng ý chia sẻ bản chụp.
                    showModal(
                      "Tạo liên kết chia sẻ?",
                      <ConfirmAdminAction
                        confirmLabel="Tạo liên kết"
                        onConfirm={async () => {
                          // Sao chép liên kết để người dùng tự gửi cho người nhận mong muốn.
                          const shared = await api<{ token: string }>(
                            `conversations/${conversation.id}/share`,
                            { method: "POST" },
                          );
                          const url = `${window.location.origin}/chia-se/${shared.token}`;
                          try {
                            await navigator.clipboard.writeText(url);
                            notify(
                              "Đã sao chép liên kết chia sẻ có hiệu lực 7 ngày.",
                            );
                          } catch {
                            window.prompt("Sao chép liên kết chia sẻ:", url);
                          }
                        }}
                      >
                        <p>
                          Bất kỳ ai có liên kết đều có thể xem nội dung hiện tại
                          trong 7 ngày. Hãy kiểm tra thông tin cá nhân trước khi
                          chia sẻ.
                        </p>
                        {["localhost", "127.0.0.1"].includes(
                          window.location.hostname,
                        ) && (
                          <p>
                            Ứng dụng đang chạy local nên liên kết chỉ mở được
                            trên máy này.
                          </p>
                        )}
                      </ConfirmAdminAction>,
                    );
                  }}
                >
                  {copy.share}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    showModal(
                      "Tắt liên kết chia sẻ?",
                      <ConfirmAdminAction
                        confirmLabel="Tắt chia sẻ"
                        onConfirm={async () => {
                          await api(`conversations/${conversation.id}/share`, {
                            method: "DELETE",
                          });
                          notify("Đã tắt liên kết chia sẻ.");
                        }}
                      >
                        <p>
                          Người nhận sẽ không thể mở liên kết đã tạo. Hội thoại
                          của bạn vẫn được giữ lại.
                        </p>
                      </ConfirmAdminAction>,
                    );
                  }}
                >
                  {copy.stopShare}
                </Button>
              </>
            )}
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setLocal(null);
                resource.setData(null);
                setError("");
                setInput("");
                try {
                  sessionStorage.removeItem(draftKey);
                  window.dispatchEvent(new Event("dtu-draft"));
                } catch {}
                router.push(routes.chat);
              }}
            >
              <span aria-hidden="true">＋</span> {copy.newChat}
            </Button>
          </div>
        }
      />
      <div className="chat-layout">
        <Card className="conversation-panel">
          <div className="assistant-identity">
            <Image className="chat-assistant-avatar" src="/figma/dtu-assistant-mascot-chest.png" alt="" width={52} height={52} />
            <div>
              <strong>{copy.assistant}</strong>
              <small>{copy.assistantDesc}</small>
            </div>
            <span className="assistant-dot" aria-hidden="true" />
          </div>
          <ResourceState
            loading={!!cid && resource.loading && !conversation}
            error={resource.error}
            retry={resource.refresh}
          />
          {!conversation && !busy && !cid && <ChatWelcome send={send} />}
          <ChatMessages
            conversation={conversation}
            documentOnly={voiceMode}
            lastAnswer={lastAnswer}
            lastQuestion={lastQuestion}
            busy={busy}
            pending={pending}
            setSourceMessageId={setSourceMessageId}
            setSourceReveal={setSourceReveal}
            send={send}
            controller={controller}
            bottom={bottom}
          />
          {!busy &&
            lastAnswer &&
            lastAnswer.status !== "error" &&
            lastAnswer.status !== "processing" && (
              <ChatFollowUps send={send} question={lastQuestion} />
            )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <VoiceMode answer={lastAnswer} language={language} enabled={voiceMode} onEnabledChange={onVoiceModeChange} requestId={voiceRequestId} onHandled={() => onVoiceRequest(null)} busy={busy} draft={input} onDraftChange={editDraft} />
          <ChatComposer
            input={input}
            textarea={textarea}
            setInput={editDraft}
            send={send}
            busy={busy}
            web={web}
            onWebChange={onWebChange}
            voiceMode={voiceMode}
          />
        </Card>
        <Sources
          answer={sourceAnswer}
          reveal={sourceReveal}
          question={sourceQuestion}
        />
      </div>
    </>
  );
}

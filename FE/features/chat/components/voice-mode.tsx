"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/components/voice-input";
import type { Message } from "@/lib/contracts";
import { matchingVoice, shouldAutoPlay, speechLanguage, speechText } from "@/lib/voice-playback";

type Props = {
  answer?: Message;
  language: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  requestId: string | null;
  onHandled: () => void;
  busy: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
};

export function VoiceMode({ answer, language, enabled, onEnabledChange, requestId, onHandled, busy, draft, onDraftChange }: Props) {
  const [reading, setReading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState("");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const playback = useRef(0);
  const text = answer && answer.status !== "error" && answer.status !== "processing" &&
    answer.citations.every(c => c.documentId !== "web") &&
    (answer.status !== "answered" || answer.citations.length > 0) ? speechText(answer.content) : "";

  const cancel = useCallback(() => {
    playback.current++;
    const current = utterance.current;
    if (!current) return;
    utterance.current = null;
    current.onstart = current.onend = current.onerror = null;
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => cancel, [cancel]);

  function stopReading() {
    cancel();
    setReading(false);
    setNotice("");
  }

  const readAnswer = useCallback(async () => {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setNotice("Trình duyệt này chưa hỗ trợ đọc thành tiếng. Bạn có thể xem câu trả lời trong hội thoại.");
      return;
    }
    cancel();
    const attempt = playback.current;
    setReading(true);
    setNotice("Đang chuẩn bị giọng đọc…");
    const targetLanguage = speechLanguage(text, language);
    if (!matchingVoice(synth.getVoices(), targetLanguage)) {
      await new Promise<void>((resolve) => {
        const done = () => { window.clearTimeout(timer); synth.removeEventListener("voiceschanged", changed); resolve(); };
        const changed = () => { if (matchingVoice(synth.getVoices(), targetLanguage)) done(); };
        const timer = window.setTimeout(done, 1500);
        synth.addEventListener("voiceschanged", changed);
      });
    }
    if (playback.current !== attempt) return;
    const current = new SpeechSynthesisUtterance(text);
    current.lang = targetLanguage;
    const voice = matchingVoice(synth.getVoices(), current.lang);
    if (!voice) {
      setReading(false);
      setNotice(`Thiết bị chưa có giọng đọc ${current.lang}. Hãy thêm giọng ngôn ngữ này trong cài đặt thiết bị hoặc thử trình duyệt khác.`);
      return;
    }
    current.voice = voice;
    utterance.current = current;
    setNotice("Đang chuẩn bị đọc…");
    current.onstart = () => setNotice("Đang đọc câu trả lời.");
    current.onend = () => {
      utterance.current = null;
      setReading(false);
      setNotice("Đã đọc xong. Nhấn Bắt đầu nói để hỏi tiếp.");
    };
    current.onerror = () => {
      utterance.current = null;
      setReading(false);
      setNotice("Trình duyệt chưa phát được âm thanh. Nhấn Nghe câu trả lời gần nhất để thử lại.");
    };
    synth.speak(current);
  }, [cancel, text, language]);

  useEffect(() => {
    if (!shouldAutoPlay(enabled, busy, requestId, answer?.id, answer?.status)) return;
    const timer = window.setTimeout(() => {
      onHandled();
      if (!capturing) void readAnswer();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, busy, requestId, answer?.id, answer?.status, capturing, onHandled, readAnswer]);

  return <section className="voice-mode" aria-label="Chế độ giọng nói">
    <button type="button" className="voice-mode-toggle" disabled={busy} aria-expanded={enabled} onClick={() => {
      stopReading();
      onHandled();
      onEnabledChange(!enabled);
    }}>
      <span aria-hidden="true">◉</span> Chế độ giọng nói <span aria-hidden="true">{enabled ? "−" : "+"}</span>
    </button>
    {enabled && <div className="voice-mode-content">
      <p>Nhấn <strong>Bắt đầu nói</strong>, kiểm tra câu hỏi bên dưới rồi nhấn <strong>Gửi</strong>. Trợ lý sẽ đọc câu trả lời từ tài liệu đã duyệt.</p>
      <VoiceInput showLabel value={draft} onChange={onDraftChange} disabled={busy} onStart={stopReading} onCaptureChange={setCapturing} />
      <div className="voice-mode-actions">
        <button type="button" disabled={!text || busy || capturing || reading} onClick={readAnswer}>▶ Nghe câu trả lời gần nhất</button>
        <button type="button" disabled={!reading} onClick={stopReading}>■ Dừng đọc</button>
      </div>
      <small role="status">{notice || (busy ? "Trợ lý đang tra tài liệu…" : !text ? "Khi có câu trả lời từ tài liệu, bạn có thể nghe lại tại đây." : "")}</small>
    </div>}
  </section>;
}

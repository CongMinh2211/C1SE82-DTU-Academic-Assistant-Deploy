"use client";

import { useEffect, useRef, useState } from "react";
import { speechErrorMessage } from "@/lib/voice-errors";
import { api } from "@/lib/api-client";
import { composeVoiceTranscript } from "@/lib/voice-transcript";

type SpeechEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type SpeechEngine = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechEngine; webkitSpeechRecognition?: new () => SpeechEngine };

type Provider = "local" | "gemini" | "browser";

export function VoiceInput({ value, onChange, disabled = false, onStart, onCaptureChange, showLabel = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; onStart?: () => void;
  onCaptureChange?: (active: boolean) => void; showLabel?: boolean;
}) {
  const [language, setLanguage] = useState("vi-VN");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [processing, setProcessing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const cancelled = useRef(false);
  const captureActive = listening || processing;
  useEffect(() => { onCaptureChange?.(captureActive); }, [captureActive, onCaptureChange]);
  useEffect(() => () => onCaptureChange?.(false), [onCaptureChange]);
  useEffect(() => {
    alive.current = true;
    let current = true;
    api<{serverEnabled:boolean; provider?:Provider}>("voice-config",{signal:AbortSignal.timeout(5000)})
      .then(config => { if (current) setProvider(config.provider ?? (config.serverEnabled ? "gemini" : "browser")); })
      .catch(() => { if (current) setProvider("browser"); });
    return () => { current = false; alive.current = false; cancelled.current = true; if (timer.current) clearTimeout(timer.current); if (recorder.current?.state !== "inactive") recorder.current?.stop(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  const engine = useRef<SpeechEngine | null>(null);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  useEffect(() => () => { const active = engine.current; engine.current = null; active?.abort(); }, []);
  // Tránh tiếp tục nhận giọng nói khi người dùng vừa gửi câu hỏi.
  useEffect(() => { if (disabled) { cancelled.current = true; engine.current?.abort(); if (recorder.current?.state === "recording") recorder.current.stop(); } }, [disabled]);

  // Ghi âm ngắn rồi chuyển thành chữ ở máy chủ; không gửi tự động câu hỏi.
  async function recordOnServer() {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMessage("Thiết bị chưa hỗ trợ ghi âm. Hãy dùng trình duyệt cập nhật hoặc nhập bằng bàn phím."); return; }
    const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm", "audio/wav"];
    const type = types.find(item => MediaRecorder.isTypeSupported(item));
    if (!type) { setMessage("Trình duyệt không hỗ trợ định dạng ghi âm tương thích."); return; }
    if (provider === "gemini") {
      let informed = false;
      try { informed = sessionStorage.getItem("voice-gemini-notice") === "yes"; } catch {}
      if (!informed && !window.confirm("Giọng nói sẽ được gửi tới Google Gemini để chuyển thành chữ. Bạn có muốn tiếp tục?")) return;
      try { sessionStorage.setItem("voice-gemini-notice", "yes"); } catch {}
    }
    setMessage("Đang mở micro…");
    setProcessing(true);
    try {
      cancelled.current = false;
      const input = await navigator.mediaDevices.getUserMedia({audio:true});
      if (!alive.current || cancelled.current) { input.getTracks().forEach(track=>track.stop()); return; }
      stream.current = input;
      const recording = new MediaRecorder(input,{mimeType:type});
      recorder.current = recording;
      const chunks: Blob[] = [];
      recording.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recording.onerror = () => {
        cancelled.current = true;
        if (timer.current) clearTimeout(timer.current);
        input.getTracks().forEach(track => track.stop()); stream.current = null;
        if (recording.state !== "inactive") recording.stop();
        else recorder.current = null;
        if (alive.current) { setListening(false); setMessage("Không thể ghi âm. Hãy kiểm tra micro và thử lại."); }
      };
      recording.onstop = async () => {
        if (timer.current) clearTimeout(timer.current);
        input.getTracks().forEach(track=>track.stop()); stream.current = null; recorder.current = null;
        if (!alive.current) return;
        setListening(false);
        if (cancelled.current) return;
        const blob = new Blob(chunks,{type:recording.mimeType});
        if (!blob.size || blob.size > 3 * 1024 * 1024) { setMessage("Bản ghi trống hoặc quá lớn. Hãy thử nói ngắn hơn."); return; }
        setProcessing(true); setMessage("Đang chuyển giọng nói thành chữ…");
        try {
          const data = new FormData(); data.append("audio",blob,"voice"); data.append("language",language === "vi-VN" ? "vi" : "en");
          data.append("provider", provider!);
          const result = await api<{text:string}>("voice/transcribe",{method:"POST",body:data,signal:AbortSignal.timeout(provider === "local" ? 95000 : 40000)});
          if (!alive.current || cancelled.current) return;
          // Nối vào nội dung hiện tại để không xóa chữ đã gõ khi đang xử lý.
          const prefix = latest.current.trimEnd();
          latest.current = (prefix ? `${prefix} ${result.text}` : result.text).slice(0,2500);
          onChange(latest.current); setMessage("Đã nhận giọng nói. Kiểm tra nội dung rồi nhấn Gửi.");
        } catch (error) { if (alive.current && !cancelled.current) setMessage(error instanceof Error ? error.message : "Không thể nhận diện. Hãy thử lại."); }
        finally { if (alive.current) setProcessing(false); }
      };
      recording.start(); setProcessing(false); setListening(true); setMessage("Đang ghi âm… Nhấn mic để chuyển thành chữ (tối đa 45 giây).");
      timer.current = setTimeout(() => { if (recording.state === "recording") recording.stop(); },45000);
    } catch (error) {
      stream.current?.getTracks().forEach(track=>track.stop()); stream.current = null; recorder.current = null;
      if (alive.current && !cancelled.current) setMessage(error instanceof DOMException && error.name === "NotAllowedError" ?
        speechErrorMessage("not-allowed") : "Không thể mở micro. Hãy kiểm tra thiết bị đầu vào rồi thử lại.");
    }
    finally { if (alive.current && !recorder.current) setProcessing(false); }
  }

  function toggle() {
    if (disabled || processing || !provider) return;
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    if (engine.current) { setMessage("Đang kết thúc nhận diện…"); engine.current.stop(); return; }
    // Ngắt giọng trợ lý trước khi thu âm lượt mới để micro không nhận lại tiếng loa.
    onStart?.();
    if (provider !== "browser") { void recordOnServer(); return; }
    cancelled.current = false;
    const browser = window as SpeechWindow;
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy thử Chrome hoặc Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    const prefix = latest.current;
    let lastRendered = prefix;
    let received = false;
    let failed = false;
    // Không xóa chữ do người dùng gõ trong khi đang nghe.
    recognition.onstart = () => { if (engine.current === recognition && !cancelled.current) setMessage("Đang nghe… Bạn hãy nói rồi nhấn mic để dừng."); };
    recognition.onresult = (event) => {
      if (engine.current !== recognition || cancelled.current || !alive.current) return;
      // Kết quả tạm cũng xuất hiện ngay, sau đó được thay bằng kết quả chính thức.
      if (latest.current !== lastRendered) {
        // Đang sửa bằng bàn phím: giữ nội dung người dùng và kết thúc phiên nhận diện.
        failed = true;
        setMessage("Đã dừng nghe để giữ nội dung bạn đang chỉnh sửa.");
        recognition.abort();
        return;
      }
      latest.current = composeVoiceTranscript(prefix, event.results);
      lastRendered = latest.current;
      received = received || event.results.length > 0;
      onChange(latest.current);
      if (received) setMessage("Đã nhận giọng nói. Kiểm tra nội dung rồi nhấn Gửi.");
    };
    recognition.onerror = ({ error }) => {
      if (engine.current !== recognition || cancelled.current || !alive.current) return;
      failed = true;
      setMessage(speechErrorMessage(error));
    };
    recognition.onend = () => {
      if (engine.current !== recognition || !alive.current) return;
      engine.current = null;
      setListening(false);
      if (cancelled.current) { setMessage(""); return; }
      if (!failed) setMessage(received ? "Đã dừng nghe. Kiểm tra nội dung rồi nhấn Gửi." : "Chưa nhận được lời nói. Kiểm tra micro mặc định và thử lại bằng Chrome hoặc Edge.");
    };
    engine.current = recognition;
    try { recognition.start(); setListening(true); setMessage("Đang khởi động micro…"); }
    catch { engine.current = null; setMessage("Không thể bật micro. Hãy kiểm tra quyền truy cập."); }
  }

  const label = listening ? "Dừng nghe" : processing ? "Đang xử lý…" : !provider ? "Đang chuẩn bị…" : "Bắt đầu nói";
  return <div className="voice-input">
    <div className="voice-language" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false); }}>
      <button type="button" className="voice-language-trigger" disabled={listening || processing || disabled} aria-label="Chọn ngôn ngữ nhận diện giọng nói" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{language === "vi-VN" ? "VI" : "EN"} <span aria-hidden="true">⌄</span></button>
      {menuOpen && <div className="voice-language-menu" role="group" aria-label="Ngôn ngữ nhận diện">
        {[["vi-VN","Tiếng Việt"],["en-US","English"]].map(([code,label]) => <button type="button" key={code} className={language === code ? "selected" : ""} onClick={() => { setLanguage(code); setMenuOpen(false); }}>{label}<span aria-hidden="true">{language === code ? "✓" : ""}</span></button>)}
      </div>}
    </div>
    <button type="button" className={`voice-button${listening ? " is-listening" : ""}`} onClick={toggle} disabled={disabled || processing || !provider} aria-label={showLabel ? label : listening ? "Dừng nhận diện giọng nói" : "Nhập câu hỏi bằng giọng nói"} aria-pressed={listening} title={listening ? "Dừng nghe" : "Nhập bằng giọng nói"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6"/></svg>
      {showLabel && <span>{label}</span>}
    </button>
    <span className="voice-status" role="status">{message || (showLabel && provider === "local" ? "Âm thanh được chuyển thành chữ trên máy chủ của ứng dụng." : "")}</span>
  </div>;
}

// Làm gọn văn bản trước khi đọc; số trích dẫn và URL vẫn còn nguyên trên màn hình.
export function speechText(content: string): string {
  return content.replace(/https?:\/\/[^\s<>]+/g, " ")
    .replace(/\[\d+\]/g, " ").replace(/[*_#`]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Nhận diện cả dấu tiếng Việt tổ hợp lẫn ký tự Unicode dựng sẵn.
export function speechLanguage(content: string, fallback: string): string {
  if (/[\u0900-\u097f]/.test(content)) return "hi-IN";
  if (/[đĐ]|[a-z][\u0300-\u0303\u0306\u0309\u031b\u0323\u0302]/i.test(content.normalize("NFD"))) return "vi-VN";
  return fallback === "vi" ? "vi-VN" : fallback === "hi" ? "hi-IN" : "en-US";
}

export function matchingVoice<T extends { lang: string }>(voices: T[], language: string): T | undefined {
  const code = language.toLowerCase().split(/[-_]/)[0];
  return voices.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-") === language.toLowerCase())
    ?? voices.find((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === code);
}

// Chỉ phát lượt voice đã gửi; không tự đọc lại nội dung hội thoại cũ khi mở trang.
export function shouldAutoPlay(enabled: boolean, busy: boolean, requestId: string | null, answerId?: string, status?: string): boolean {
  return enabled && !busy && !!requestId && answerId === requestId && status !== "processing";
}

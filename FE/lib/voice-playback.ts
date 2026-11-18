// Làm gọn văn bản trước khi đọc; số trích dẫn và URL vẫn còn nguyên trên màn hình.
export function speechText(content: string): string {
  return content.replace(/https?:\/\/[^\s<>]+/g, " đường dẫn ")
    .replace(/\[\d+\]/g, " ").replace(/[*_#`]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Ưu tiên giọng phù hợp ngôn ngữ nội dung; thiếu giọng thì trình duyệt dùng mặc định.
export function speechLanguage(content: string, fallback: string): string {
  if (/[\u0900-\u097f]/.test(content)) return "hi-IN";
  if (/[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/i.test(content)) return "vi-VN";
  return fallback === "vi" ? "vi-VN" : fallback === "hi" ? "hi-IN" : "en-US";
}

// Chỉ phát lượt voice đã gửi; không tự đọc lại nội dung hội thoại cũ khi mở trang.
export function shouldAutoPlay(enabled: boolean, busy: boolean, requestId: string | null, answerId?: string, status?: string): boolean {
  return enabled && !busy && !!requestId && answerId === requestId && status !== "processing";
}

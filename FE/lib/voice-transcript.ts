// Dựng lại toàn bộ kết quả của một phiên, gồm chữ tạm và chữ đã xác nhận.
// API có thể gửi lại các đoạn cũ; không nối chồng từng sự kiện.
export function composeVoiceTranscript(
  prefix: string,
  results: ArrayLike<{ 0: { transcript: string } }>,
  limit = 2500,
): string {
  const spoken = Array.from(results, result => result[0]?.transcript || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return [prefix.trim(), spoken].filter(Boolean).join(" ").slice(0, limit);
}

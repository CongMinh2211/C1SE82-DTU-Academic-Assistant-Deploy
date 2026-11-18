// Mục đích file: Tổng hợp lượt sử dụng và các khoảng thời gian thống kê theo dữ liệu thực của hệ thống.
import { universityDate } from "./rag/date";
import { rows } from "./db";
import { usageTopics, type UsageReport } from "@/lib/usage";

export type UsageTrace = {
  id: string;
  question: string;
  status: string;
  reason: string | null;
  conversation_id: string;
  created_at: string;
};
// Chuẩn hóa chữ tiếng Việt trước khi phân nhóm câu hỏi thống kê.
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase();
export function usageTopic(
  trace: Pick<UsageTrace, "question" | "status" | "reason">,
  previous = "",
) {
  // Ưu tiên tách lời chào và cảm ơn khỏi chủ đề học vụ để không tăng nhầm lượt hỏi.
  const q = normalize(trace.question),
    reason = trace.reason || "";
  if (
    /^(?:capabilities|greeting|thanks|goodbye|small_talk|conversation)(?:;|$)/.test(
      reason,
    ) ||
    /^(?:xin chao|chao|hi|hello|cam on|thanks?|thank you|ok|okay)[!.\s]*$/.test(
      q,
    )
  )
    return "Trò chuyện";
  if (/tot nghiep|klt[n]?|datn|khoa luan|do an|gdqp|graduat|thesis/.test(q))
    return "Tốt nghiệp";
  if (/hoc phi|tin chi.*(?:bao nhieu|dong)|tuition|fee|dong tien/.test(q))
    return "Học phí";
  if (
    /dang ky|huy dang ky|hoc phan|hoc vuot|no mon|credit|registration|enrol/.test(
      q,
    ) &&
    !/diem hoc phan|tinh diem/.test(q)
  )
    return "Đăng ký học phần";
  if (
    /tinh diem|diem hoc phan|diem chu|diem so|thang diem|xep loai|hoc luc|gpa|grade|phuc khao/.test(
      q,
    )
  )
    return "Điểm số";
  if (
    previous &&
    /^(?:con |vay |the |neu |giai thich|noi ro|rut |soan .*?(?:vua roi|tren)|what about|and |explain|make it|shorten)/.test(
      q,
    )
  )
    return previous;
  if (
    reason.startsWith("study_support") ||
    /on thi|bai tap|bai hoc|ke hoach hoc|revision|study plan|coding|algorithm/.test(
      q,
    )
  )
    return "Hỗ trợ học tập";
  return trace.status === "conversation"
    ? "Trò chuyện"
    : "Thông tin DTU / khác";
}
export function usageWindow(days: number, date = new Date()) {
  const to = universityDate(date);
  const end = new Date(`${to}T00:00:00+07:00`);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return {
    from: universityDate(start),
    to,
    start: start.toISOString(),
    end: new Date(end.getTime() + 86400000).toISOString(),
  };
}
export function summarizeUsage(
  traces: UsageTrace[],
  days: number,
  topic = "",
  date = new Date(),
): UsageReport {
  const window = usageWindow(days, date),
    buckets = new Map<string, number>(),
    counts = new Map(usageTopics.map((t) => [t, 0])),
    outcomes = new Map<string, number>();
  for (let i = 0; i < days; i++)
    buckets.set(
      universityDate(new Date(new Date(window.start).getTime() + i * 86400000)),
      0,
    );
  const contexts = new Map<string, string>();
  let total = 0;
  for (const trace of [...traces].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )) {
    const label = usageTopic(trace, contexts.get(trace.conversation_id));
    if (!["Trò chuyện", "Thông tin DTU / khác"].includes(label))
      contexts.set(trace.conversation_id, label);
    const time = new Date(trace.created_at);
    if (
      !Number.isFinite(time.getTime()) ||
      time.toISOString() < window.start ||
      time.toISOString() >= window.end ||
      (topic && label !== topic)
    )
      continue;
    const key = universityDate(time);
    buckets.set(key, (buckets.get(key) || 0) + 1);
    counts.set(label, (counts.get(label) || 0) + 1);
    outcomes.set(trace.status, (outcomes.get(trace.status) || 0) + 1);
    total++;
  }
  return {
    days,
    from: window.from,
    to: window.to,
    timeZone: "Asia/Ho_Chi_Minh",
    topic,
    total,
    daily: [...buckets].map(([date, count]) => ({ date, count })),
    outcomes: [...outcomes]
      .map(([status, count]) => ({
        status,
        count,
        percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
    topics: [...counts]
      .map(([label, count]) => ({
        label,
        count,
        percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}
export async function usageReport(days: number, topic = "") {
  const window = usageWindow(days);
  const traces = await rows<UsageTrace>(
    "SELECT id,question,status,reason,conversation_id,created_at FROM traces WHERE created_at>=? AND created_at<? ORDER BY created_at,id",
    window.start,
    window.end,
  );
  return summarizeUsage(traces, days, topic);
}

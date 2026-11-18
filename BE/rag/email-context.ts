// Mục đích file: Giữ các thông tin người dùng đã cung cấp khi soạn email, tránh tự điền dữ liệu chưa biết.
import { normalize } from "./parser";
import { questionCohorts, questionMajorCodes } from "./retrieve";
import type { Turn } from "./dialogue";
type EmailCase = {
  cohort?: string;
  programmeCode?: string;
  academicYear?: string;
  tuitionLateDays?: number;
};
export function knownEmailCase(question: string, history: Turn[]): EmailCase {
  // Nếu yêu cầu mẫu ẩn danh hoặc để trống, không mang dữ kiện cá nhân vào thư.
  if (
    /an danh|anonym|redact|mau trong|de trong tat ca|tu dien tat ca|khong dien thong tin/.test(
      normalize(question),
    )
  )
    return {};
  // Chỉ lấy lượt hỏi trước khi yêu cầu hiện tại nhắc tới nội dung trước đó.
  const refersBack =
    /vua roi|truoc do|cau hoi truoc|noi dung tren|previous|above|earlier|that case/.test(
      normalize(question),
    );
  const previous = history.findLast((t) => t.role === "user")?.content;
  const inputs = refersBack && previous ? [previous, question] : [question];
  const detail: {
    cohort?: string;
    programmeCode?: string;
    academicYear?: string;
    tuitionLateDays?: number;
  } = {};
  // Trích khóa, mã ngành và năm học từ dữ liệu đã cung cấp; giá trị mơ hồ không tự chọn.
  for (const input of inputs) {
    const cohorts = questionCohorts(input);
    if (cohorts.length)
      detail.cohort = cohorts.length === 1 ? `K${cohorts[0]}` : undefined;
    const normalized = normalize(input),
      codes = questionMajorCodes(input);
    if (
      /\b(?:ma|code)\s*(?:chuyen nganh|chuong trinh)?\s*\d{3}/.test(
        normalized,
      ) &&
      codes.length
    )
      detail.programmeCode =
        codes.length === 1 ? codes[0].toUpperCase() : undefined;
    const year = input.match(/20\d{2}\s*[-–/]\s*20\d{2}/)?.[0];
    if (year) detail.academicYear = year.replace(/\s/g, "");
    if (/hoc phi|tuition/.test(normalized)) {
      const days =
        normalized.match(
          /(?:tre|cham|late|overdue)[^\d]{0,12}(\d{1,3})\s*(?:ngay|days?)/,
        )?.[1] || normalized.match(/(\d{1,3})\s*days?\s*(?:late|overdue)/)?.[1];
      if (days) detail.tuitionLateDays = Number(days);
    }
  }
  return detail;
}
export function fillKnownEmailContext(
  reply: string,
  question: string,
  history: Turn[],
) {
  if (
    !/\b(?:soan|viet|draft|write)\b[\s\S]*\b(?:email|mail)\b/.test(
      normalize(question),
    )
  )
    return reply;
  const detail = knownEmailCase(question, history);
  let result = reply.replace(/\[([^\]\n]{1,80})\]/g, (whole, label: string) => {
    const key = normalize(label).trim();
    if (/^(?:khoa|cohort)(?: hoc| cua ban)?$/.test(key) && detail.cohort)
      return detail.cohort;
    if (/^(?:nam hoc|academic year)$/.test(key) && detail.academicYear)
      return detail.academicYear;
    if (
      /^(?:so ngay(?: tre)?|number of days)$/.test(key) &&
      detail.tuitionLateDays !== undefined
    )
      return String(detail.tuitionLateDays);
    if (
      /ma (?:chuyen )?nganh|ma chuong trinh|programme code/.test(key) &&
      detail.programmeCode
    )
      return detail.programmeCode;
    return whole;
  });
  const english = /^Dear\b/im.test(result),
    missing: string[] = [];
  if (detail.cohort && !result.includes(detail.cohort))
    missing.push(`${english ? "cohort" : "khóa"} ${detail.cohort}`);
  if (detail.programmeCode && !result.includes(detail.programmeCode))
    missing.push(
      `${english ? "programme code" : "mã chương trình"} ${detail.programmeCode}`,
    );
  if (
    detail.academicYear &&
    !normalize(result)
      .replace(/[–\s-]/g, "")
      .includes(detail.academicYear.replace(/[–\s-]/g, ""))
  )
    missing.push(
      `${english ? "academic year" : "năm học"} ${detail.academicYear}`,
    );
  if (
    detail.tuitionLateDays !== undefined &&
    !new RegExp(`\\b${detail.tuitionLateDays}\\b`).test(result)
  )
    missing.push(
      `${english ? "tuition payment delayed by" : "đóng học phí trễ"} ${detail.tuitionLateDays} ${english ? "days" : "ngày"}`,
    );
  if (missing.length) {
    const context = `${english ? "Case details provided" : "Thông tin trường hợp đã cung cấp"}: ${missing.join(", ")}.`;
    const greeting = /^((?:Kính gửi|Dear|To)[^\n]*)(\r?\n)/im;
    result = greeting.test(result)
      ? result.replace(greeting, `$1\n\n${context}\n`)
      : `${result}\n\n${context}`;
  }
  return result;
}

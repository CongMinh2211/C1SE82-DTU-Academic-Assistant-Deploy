// Mục đích file: Nhận diện điều kiện tra bảng học phí và trả đúng giá trị theo khóa, mã ngành và năm học.
import { normalize } from "./parser";
import {
  questionCohorts,
  questionMajorCodes,
  tuitionQuestion,
  type Evidence,
} from "./retrieve";
import { isEnglish } from "./dialogue";
import { citationFromEvidence } from "./citations";
import type { Answer } from "./answer";

export function tuitionLookupSpec(question: string) {
  const q = normalize(question),
    cohorts = questionCohorts(question),
    codes = questionMajorCodes(question),
    period = q
      .match(/20\d{2}\s*[-–/]\s*20\d{2}/)?.[0]
      .replace(/\s/g, "")
      .replace(/[–/]/g, "-");
  if (
    !tuitionQuestion(question) ||
    !cohorts.length ||
    !codes.length ||
    !period ||
    cohorts.length * codes.length > 8
  )
    return null;
  if (
    /\b(?:soan|viet|email|mail|draft|write|ke hoach|plan|giai thich|explain)\b/.test(
      q,
    ) ||
    /\btheo\s+(?!(?:bang|bieu|tai lieu|du lieu|file|tep)\b)|\baccording to\b/.test(
      q,
    )
  )
    return null;
  // Only reporting exact table values is deterministic. Deadlines, discounts,
  // penalties, calculations, web verification and mixed topics need reasoning.
  if (
    /\b(?:phat|tre|cham|mien|giam|hoc bong|hoan|no|han|khi nao|chinh sach|dieu kien|quy trinh|cach|dang ky|tot nghiep|dia chi|co so|tru so|hieu truong|thanh lap|tinh|tong|uoc tinh|web|website|internet|bao chi|moi nhat|hien nay|hien tai|bao gom|bao ham|le phi|bao hiem|dich vu|ngoai ra|dong thoi|bao luu|thoi khoa bieu|fine|late|penalty|discount|scholarship|deadline|calculate|total|refund|registration|graduation|when|latest|current|today|includes?|additional|also)\b/.test(
      q,
    )
  )
    return null;
  return { cohorts, codes, period };
}
export function tuitionTableAnswer(
  question: string,
  evidence: Evidence[],
  replyInEnglish?: boolean,
): Answer | null {
  const spec = tuitionLookupSpec(question);
  if (!spec) return null;
  const matches = [];
  for (const cohort of spec.cohorts)
    for (const code of spec.codes) {
      const candidates = evidence.flatMap((source) => {
        if (
          source.documentId === "web" ||
          !/\bdon vi\s*:?\s*dong\b/.test(normalize(source.scope)) ||
          !new RegExp(`\\bk${cohort}\\b`).test(normalize(source.title)) ||
          !normalize(source.title + " " + source.scope)
            .replace(/–/g, "-")
            .includes(spec.period) ||
          !/Don gia tin chi|don gia tin chi/.test(normalize(source.text)) ||
          !/muc hoc phi\/hoc ky/.test(normalize(source.text))
        )
          return [];
        const line = source.text
          .split("\n")
          .find((line) => /^\d+\s*\|/.test(line));
        if (!line) return [];
        const cells = line.split("|").map((cell) => cell.trim());
        if (
          cells[2]?.replace(/\s/g, "").toLowerCase() !== code ||
          cells.length < 5
        )
          return [];
        if (
          ![cells[3], cells[4]].every(
            (value) => !value || /^\d[\d,.]*$/.test(value),
          )
        )
          return [];
        return [{ source, cells }];
      });
      if (!candidates.length) return null;
      // Conflicting duplicates never get resolved by choosing the first row.
      if (
        new Set(candidates.map((c) => JSON.stringify(c.cells.slice(3)))).size >
        1
      )
        return null;
      matches.push({ cohort, code, ...candidates[0] });
    }
  const english = replyInEnglish ?? isEnglish(question);
  const citations = matches.map((m, i) =>
    citationFromEvidence(m.source, String(i + 1)),
  );
  const amount = (value: string) =>
    value
      ? `${/^\d{1,3}(?:,\d{3})+$/.test(value) ? value.replaceAll(",", ".") : value} ${english ? "VND" : "đồng"}`
      : english
        ? "not specified in the original table"
        : "chưa ghi trong bảng gốc";
  const content = matches
    .map(
      (m, i) =>
        `${english ? "Cohort" : "Khóa"} K${m.cohort} · ${m.cells[1]} (${english ? "code" : "mã"} ${m.cells[2]})\n${english ? "Academic year" : "Năm học"} ${spec.period}:\n• ${english ? "Per semester" : "Học phí học kỳ"}: ${amount(m.cells[4])}.\n• ${english ? "Per credit" : "Đơn giá tín chỉ"}: ${amount(m.cells[3])}.${m.cells.slice(5).filter(Boolean).length ? `\n${english ? "Table note" : "Ghi chú trong bảng"}: ${m.cells.slice(5).filter(Boolean).join(" | ")}` : ""} [${i + 1}]`,
    )
    .join("\n\n");
  return {
    status: "answered",
    content,
    citations,
    retrieval: matches.map((m) => ({ chunkId: m.source.chunkId, score: 1 })),
    reason: "structured_tuition",
    webStatus: "not_needed",
  };
}

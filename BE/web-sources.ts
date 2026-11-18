// Mục đích file: Phân loại nguồn web, chuẩn hóa liên kết và chọn đoạn nội dung phù hợp trước khi đưa vào bằng chứng.
import { normalize } from "./rag/parser";

export type SourceTier =
  "official" | "institutional" | "press" | "reference" | "other";
export function requestedPublisherBoost(url: string, query: string) {
  // Chỉ tăng ưu tiên cho nhà xuất bản đã phân loại và được nhắc trong câu hỏi.
  if (sourceAssessment(url).tier === "other") return 0;
  const labels = new URL(url).hostname.replace(/^www\./, "").split(".");
  const stem = labels.at(-2) || "";
  if (
    stem.length < 6 ||
    /^(?:university|education|rankings?|student|news|research|online|academic)$/.test(
      stem,
    )
  )
    return 0;
  return normalize(query)
    .replace(/[^a-z0-9]/g, "")
    .includes(stem)
    ? 500
    : 0;
}
export function sourceAssessment(value: string): {
  tier: SourceTier;
  label: string;
  reason: string;
  priority: number;
} {
  // So khớp miền hoặc miền con thực sự để tên miền giả không được coi là DTU.
  const host = new URL(value).hostname.toLowerCase();
  const domain = (root: string) => host === root || host.endsWith(`.${root}`);
  if (domain("duytan.edu.vn"))
    return {
      tier: "official",
      label: "Nguồn DTU",
      reason:
        "Tên miền chính thức của Đại học Duy Tân; vẫn cần kiểm tra ngày và phạm vi áp dụng.",
      priority: 100,
    };
  if (
    /\.(gov\.vn|gov|edu\.vn|edu|ac\.uk)$/.test(host) ||
    ["timeshighereducation.com", "topuniversities.com", "moet.gov.vn"].some(
      domain,
    )
  )
    return {
      tier: "institutional",
      label: "Cơ quan / tổ chức",
      reason:
        "Nguồn cơ quan, cơ sở giáo dục hoặc tổ chức chuyên môn; không mặc định là quy định nội bộ DTU.",
      priority: 85,
    };
  if (
    [
      "vnexpress.net",
      "tuoitre.vn",
      "thanhnien.vn",
      "vietnamnet.vn",
      "dantri.com.vn",
      "vov.vn",
      "vtv.vn",
      "vietnamplus.vn",
      "nhandan.vn",
      "baochinhphu.vn",
    ].some(domain)
  )
    return {
      tier: "press",
      label: "Báo chí",
      reason:
        "Bài báo bên ngoài trường; cần đối chiếu thời điểm và nguồn chính thức khi nói về quy định đang áp dụng.",
      priority: 65,
    };
  if (["wikipedia.org", "edurank.org"].some(domain))
    return {
      tier: "reference",
      label: "Nguồn tham khảo",
      reason:
        "Nguồn tham khảo bên thứ ba; chỉ dùng với sự ghi nhận nguồn, không thay thế quy định chính thức.",
      priority: 45,
    };
  return {
    tier: "other",
    label: "Cần đối chiếu",
    reason:
      "Chưa xác định được thẩm quyền của nhà xuất bản; không dùng riêng nguồn này để kết luận.",
    priority: 15,
  };
}
export function relevantToUniversity(title: string, text: string, url: string) {
  const value = normalize(`${title}\n${text}`);
  return (
    sourceAssessment(url).tier === "official" ||
    /\b(?:dai hoc duy tan|dh duy tan|duy tan university)\b|duytan\.edu\.vn/.test(
      value,
    )
  );
}
export function canonicalSearchUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|msclkid)$/i.test(key))
      url.searchParams.delete(key);
  return url.href;
}
export function webRelevance(text: string, query: string) {
  const value = normalize(text),
    words = normalize(query).match(/[a-z0-9]{2,}/g) || [];
  let score = [...new Set(words)].filter(
    (word) => word.length > 2 && value.includes(word),
  ).length;
  for (const n of [2, 3, 4])
    for (let i = 0; i <= words.length - n; i++)
      if (value.includes(words.slice(i, i + n).join(" "))) score += n * n;
  return score;
}
export function selectedPassages(text: string, query: string) {
  if (text.length <= 14000) return text;
  const terms = [
    ...new Set(normalize(query).match(/[a-z0-9]{3,}/g) || []),
  ].filter(
    (t) =>
      ![
        "the",
        "and",
        "what",
        "how",
        "toi",
        "ban",
        "cho",
        "cua",
        "nhung",
        "duoc",
        "thong",
        "tin",
        "duy",
        "tan",
      ].includes(t),
  );
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const ranked = paragraphs
    .map((p, i) => ({
      p,
      i,
      score:
        terms.filter((t) => normalize(p).includes(t)).length +
        webRelevance(p, query),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const indexes = new Set([
    ...paragraphs.slice(0, 2).map((_, i) => i),
    ...ranked.flatMap((p) => [p.i - 1, p.i, p.i + 1]),
  ]);
  const unique = new Set<string>();
  let size = 0;
  return paragraphs
    .filter((p, i) => {
      if (!indexes.has(i) || unique.has(p) || size + p.length > 14000)
        return false;
      unique.add(p);
      size += p.length;
      return true;
    })
    .join("\n\n");
}

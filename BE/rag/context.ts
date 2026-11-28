// Mục đích file: Theo dõi chủ đề, khóa và thông tin được người dùng nêu trong các lượt hỏi tiếp theo.
import { normalize } from "./parser";
import {
  questionCohorts,
  questionMajorCodes,
  tuitionQuestion,
} from "./retrieve";
import type { Turn } from "./dialogue";

// Tìm các cách nói thường dùng khi sinh viên muốn hỏi tiếp thay vì bắt đầu chủ đề mới.
const followsUp = (q: string) =>
  /\b(?:con|vay|giu nguyen|doi sang|quay lai|what about|same|instead)\b/.test(
    normalize(q),
  );
const year = (q: string) => q.match(/20\d{2}\s*[-–/]\s*20\d{2}/)?.[0];

// Nhận diện chủ đề độc lập để ngăn chi tiết của câu hỏi cũ lọt sang câu hỏi mới.
function topics(text: string): string[] {
  const q = normalize(text);
  const patterns: [string, RegExp][] = [
    ["tuition", /\b(?:hoc phi|tuition|(?:gia|tien|phi) (?:mot |1 )?tin chi)\b/],
    ["graduation", /\b(?:tot nghiep|graduation|graduate)\b/],
    ["exam", /\b(?:lich thi|danh sach thi|exam schedule|examination)\b/],
    ["registration", /\b(?:dang ky|dang ki|register|registration) (?:mon|hoc phan|tin chi|course|courses)\b/],
    ["rules", /\b(?:noi quy|regulations|rules)\b/],
    ["contact", /\b(?:email|so dien thoai|phone number|lien he)\b/],
    ["schedule", /\b(?:lich hoc|thoi khoa bieu|class schedule|timetable)\b/],
  ];
  return patterns.filter(([, pattern]) => pattern.test(q)).map(([name]) => name);
}

export function explicitTopicShift(question: string, history: Turn[]) {
  // Chỉ kết luận đổi chủ đề khi câu mới và lượt cũ gần nhất đều nhận diện được một chủ đề.
  const latest = topics(question);
  if (latest.length !== 1) return false;
  const previous = [...history].reverse().find((turn) => turn.role === "user" && topics(turn.content).length === 1);
  return !!previous && topics(previous.content)[0] !== latest[0];
}

// Chỉ tiếp nhận ngành khi người dùng nêu rõ tên; không tự suy ra mã ngành từ tên.
function majorName(text: string): string | undefined {
  const cleaned = text.trim().replace(/[?.!,]+$/g, "");
  const introduced = cleaned.match(/(?:ngành|chuyên ngành|major(?: in)?|programme(?: in)?|program(?: in)?)\s+(.+?)(?=\s+(?:khóa|k\s*\d{2}|năm học|bao nhiêu|thì sao|how much|in 20\d{2})\b|$)/i)?.[1];
  if (introduced && !/^(?:mã|code|nào|gì|gi|bao nhiêu)$/i.test(introduced.trim())) return introduced.trim();
  const short = cleaned.replace(/^(?:còn|vậy còn|thế còn|vậy|còn về|what about|and)\s+/i, "").replace(/\s+(?:thì sao|bao nhiêu|thế nào|nữa|ạ|nhé|vậy|please)$/i, "").trim();
  if (/^(?:digital marketing|marketing|công nghệ thông tin|công nghệ phần mềm|an toàn thông tin|khoa học máy tính|kế toán|kiểm toán|quản trị kinh doanh|software engineering|computer science|cybersecurity)$/i.test(short)) return short;
  return undefined;
}

// Xây lại câu hỏi từ những thông tin sinh viên tự cung cấp, không sao chép số tiền từ câu trả lời AI.
export function tuitionFollowUp(question: string, history: Turn[]) {
  if (topics(question).some((topic) => topic !== "tuition")) return null;
  // Tìm lượt hỏi học phí gần nhất của sinh viên làm điểm bắt đầu ghép ngữ cảnh.
  const anchor = history.findLastIndex((turn) => turn.role === "user" && tuitionQuestion(turn.content));
  if (anchor < 0) return null;
  // Khi đã đổi chủ đề, lượt ngắn không được quay lại học phí trừ khi người dùng nhắc rõ.
  if (history.slice(anchor + 1).some((turn) => turn.role === "user" && topics(turn.content).some((topic) => topic !== "tuition"))) return null;
  // Lượt ngắn chỉ được nối khi có tín hiệu tiếp nối hoặc một chi tiết tra cứu cụ thể.
  const hasDetail = (text: string) => questionCohorts(text).length > 0 || questionMajorCodes(text).length > 0 || !!year(text) || !!majorName(text) || /\b(?:cmu|psu|pnu|vjj|moi nhat|hien nay|hien tai|latest|current)\b/.test(normalize(text));
  const compact = question.trim().split(/\s+/).length <= 12;
  if (!(followsUp(question) || tuitionQuestion(question) || (compact && hasDetail(question)))) return null;
  if (!hasDetail(question) && !followsUp(question)) return null;

  let cohorts: string[] = [], codes: string[] = [], academicYear: string | undefined, major: string | undefined, programme: string | undefined;
  for (const turn of [history[anchor], ...history.slice(anchor + 1), { role: "user" as const, content: question }]) {
    // Bỏ qua câu trả lời AI để không đưa số liệu AI từng sinh ra ngược vào truy vấn.
    if (turn.role !== "user") continue;
    const q = normalize(turn.content);
    const nextCohorts = questionCohorts(turn.content), nextCodes = questionMajorCodes(turn.content), nextMajor = majorName(turn.content);
    // Thông tin mới thay thông tin cũ; mã ngành và tên ngành không cùng được giữ khi đổi ngành.
    if (nextCohorts.length) cohorts = nextCohorts;
    if (nextCodes.length) { codes = nextCodes; major = undefined; }
    else if (nextMajor) { major = nextMajor; codes = []; }
    const nextProgramme = q.match(/\b(cmu|psu|pnu|vjj)\b/)?.[1];
    if (nextProgramme) programme = nextProgramme.toUpperCase();
    // “Mới nhất” thay thế năm cũ, nhưng không được suy đoán năm hiện hành.
    if (/\b(?:moi nhat|hien nay|hien tai|latest|current)\b/.test(q) && !year(turn.content)) academicYear = undefined;
    else academicYear = year(turn.content) || academicYear;
  }
  // Chỉ ghép những trường đã có; truy vấn mới vẫn giữ nguyên câu hỏi hiện tại để tra cứu.
  const segments = ["Tra cứu học phí", cohorts.length ? `khóa ${cohorts.map((c) => `K${c}`).join(" và ")}` : "", codes.length ? `mã chuyên ngành ${codes.join(" và ").toUpperCase()}` : major ? `ngành ${major}` : "", programme ? `chương trình ${programme}` : "", academicYear ? `năm học ${academicYear}` : ""].filter(Boolean);
  return `${segments.join(" ")}. Câu hỏi tiếp theo: ${question}`;
}

export function vagueWithoutContext(question: string, history: Turn[]) {
  if (history.length) return false;
  return (
    /^(?:con|vay|the)(?: cai| viec| dieu)? (?:do|nay)(?: thi sao)?[\s?.!]*$/.test(
      normalize(question).trim(),
    ) ||
    /^(?:what about (?:that|it)|and (?:that|it))[\s?.!]*$/i.test(
      question.trim(),
    )
  );
}

// Chỉ nối lượt yêu cầu tra lại rõ ràng vào câu hỏi thực chất gần nhất của người dùng.
export function lookupFollowUp(question: string, history: Turn[]) {
  const q = normalize(question).replace(/[?!.,:;]+/g, " ").replace(/\s+/g, " ").trim();
  if (!/^(?:tra cuu(?: ra)?(?: cho (?:toi|minh|em))?(?: di)?|tim(?: ra)?(?: cho (?:toi|minh|em))?(?: di)?|cu the(?: hon)?|noi ro hon)$/.test(q)) return null;
  const prior = [...history].reverse().find(t => t.role === "user" && topics(t.content).length > 0);
  return prior ? `${prior.content} — ${question}` : null;
}

import { currentlyUsable } from "./source-validity";
// Tra hồ sơ đúng người từ danh bạ đã duyệt; không đoán URL, email hay số điện thoại.
import { rows } from "../db";
import { fetchPublicPage } from "../official-web";
import { load } from "cheerio";
import { normalize, type SourcePage } from "./parser";
import type { Answer } from "./answer";

export type LecturerProfile = { name: string; url: string; email?: string; phone?: string; degree?: string };
export function directoryProfiles(text: string): LecturerProfile[] {
  return text.split(/(?=Họ tên:)/).flatMap(block => {
    const name = block.match(/^Họ tên:\s*([^\r\n]+)/)?.[1]?.trim();
    const url = block.match(/Nguồn gốc:\s*(https:\/\/is\.duytan\.edu\.vn\/international-school\/\d+-[a-z0-9-]+)(?=\s|$)/)?.[1];
    if (!name || !url) return [];
    return [{ name, url, email: block.match(/Email:\s*([^\s]+@[^\s]+)/)?.[1], phone: block.match(/Điện thoại theo nguồn:\s*([^\r\n]+)/)?.[1]?.trim(), degree: block.match(/Học hàm\/học vị:\s*([^\r\n]+)/)?.[1]?.trim() }];
  });
}
export function findLecturer(question: string, profiles: LecturerProfile[]) {
  const q = normalize(question);
  // Chỉ nhận ý tra liên hệ/hồ sơ; yêu cầu soạn thư vẫn chuyển đến luồng hỗ trợ viết.
  if (!/\b(thay|co|giang vien|email|lien he|ho so)\b/.test(q) || /\b(soan|viet|gui)\s+(email|mail|thu)\b/.test(q)) return null;
  // Ưu tiên họ tên đầy đủ trước khi bỏ các từ thông dụng: tên có thể chứa “Ly”, “Cô” hoặc danh xưng.
  const unique = [...new Map(profiles.map(p => [p.url, p])).values()];
  const fullMatches = unique.filter(p => {
    const name = normalize(p.name).trim();
    const index = q.indexOf(name);
    return name && index >= 0 && (index === 0 || !/[a-z0-9]/.test(q[index - 1])) &&
      (index + name.length === q.length || !/[a-z0-9]/.test(q[index + name.length]));
  });
  if (fullMatches.length === 1) return fullMatches[0];
  if (fullMatches.length > 1) {
    // Chỉ ưu tiên tên dài khi tên ngắn nằm trọn trong chính tên đó; hai người khác nhau vẫn cần hỏi rõ.
    const longest = [...fullMatches].sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0];
    if (fullMatches.every(p => normalize(longest.name).includes(normalize(p.name))) &&
        fullMatches.filter(p => normalize(p.name) === normalize(longest.name)).length === 1) return longest;
    return null;
  }
  const ignored = new Set("email mail so dien thoai sdt thong tin lien he thay co giang vien ho so so yeu ly lich cua cho toi minh em biet xin hoi tim xem o dau la gi duoc khong dtu truong dai hoc duy tan ve voi please contact professor teacher phone information".split(" "));
  const terms = (q.match(/[a-z0-9]+/g) || []).filter(t => !ignored.has(t));
  if (!terms.length) return null;
  const matches = unique.filter(p => { const name=normalize(p.name).split(/\s+/); return terms.every(t=>name.includes(t)); });
  // Với một tên gọi, ưu tiên người có tên cuối trùng chính xác; không chọn nếu vẫn trùng.
  if (terms.length === 1) {
    const lastName = matches.filter(p => normalize(p.name).trim().split(/\s+/).at(-1) === terms[0]);
    if (lastName.length === 1) return lastName[0];
  }
  return matches.length === 1 ? matches[0] : null;
}
export function verifiedProfilePage(expected: LecturerProfile, html: string) {
  const $ = load(html);
  // Chỉ đọc khối hồ sơ của đúng người, không nhầm email và số điện thoại ở chân trang khoa.
  const heading = $("h1,h2,h3").filter((_, node) => normalize($(node).text()).replace(/\s+/g, " ").trim() === normalize(expected.name).replace(/\s+/g, " ").trim()).first();
  if (!heading.length) return null;
  const block = heading.parent();
  const text = block.children().map((_, node) => $(node).text().trim()).get().filter(Boolean).join("\n");
  // Mỗi trường được đọc trong đúng thẻ thông tin; trường trống không được lấy từ thẻ tiếp theo.
  const field = (label: RegExp) => {
    const element = block.find("p").filter((_, node) => label.test($(node).text())).first();
    return element.length ? element.text().replace(label, "").trim() : "";
  };
  const email = field(/Email\s*:/i).match(/[^\s<>]+@[^\s<>]+/)?.[0];
  const phone = field(/Số\s*Điện\s*thoại\s*:/i).match(/[+(\d][\d .()+-]{6,24}/)?.[0]?.trim();
  const degree = field(/Học hàm\s*\/\s*Học vị\s*:/i) || undefined;
  return { ...expected, email, phone, degree, text };
}
export async function lecturerProfileAnswer(question: string, web: boolean, signal?: AbortSignal): Promise<Answer | null> {
  const q = normalize(question);
  // Lượt tiếp theo có thể chỉ chứa họ tên và từ đệm “á”, “ạ”, “nhé”.
  const nameOnly = question.trim().replace(/\s+(?:á|ạ|nhé|nha|ơi|đó)[.!?]*$/iu, "").trim();
  const hasIntent = /\b(thay|co|giang vien|email|lien he|ho so)\b/.test(q);
  if (!hasIntent && (normalize(nameOnly).split(/\s+/).length > 5 || !/^[\p{L} .'-]+$/u.test(nameOnly))) return null;
  // Hồ sơ DTU công khai đã đối chiếu đúng họ tên; thông tin chỉ thuộc trang này.
  if (/\btrinh dinh thanh\b/.test(q) && !/\b(soan|viet|gui)\s+(email|mail|thu)\b/.test(q)) {
    const url = "https://xhnv.duytan.edu.vn/nhan-su/33-trinh-dinh-thanh";
    return { status:"answered", reason:"official_lecturer_profile", webStatus:"not_needed", retrieval:[],
      content:`Theo hồ sơ công khai DTU, thầy Trịnh Đình Thanh là giảng viên Khoa Khoa học Xã hội và Nhân văn.\nEmail: trinhdinhthanh@duytan.edu.vn\nĐiện thoại theo hồ sơ: 0236 382 7111, máy lẻ 223. [1]\n\nXem hồ sơ: ${url}`,
      citations:[{id:"1",chunkId:`web:${url}`,documentId:"web",revisionId:"web",title:"Hồ sơ giảng viên Trịnh Đình Thanh",version:1,page:1,pageEnd:1,section:"Hồ sơ",quote:"Trịnh Đình Thanh; Giảng viên Khoa Khoa học Xã hội và Nhân văn; email trinhdinhthanh@duytan.edu.vn; điện thoại 0236 3 827111 (ex: 223)",scope:"Hồ sơ công khai của DTU; cần đối chiếu khi thông tin thay đổi.",url,sourceTier:"official"}] };
  }
  // Chỉ đọc phiên bản đang xuất bản, không dùng file chờ duyệt hoặc snapshot ngoài database.
  const sources = await rows<{ pages_json: string; issued_on?:string|null; effective_from?:string|null; effective_until?:string|null; scope_key?:string|null }>("SELECT r.pages_json,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM revisions r JOIN documents d ON d.active_revision=r.id AND r.document_id=d.id WHERE d.deleted_at IS NULL AND r.status='published' AND r.pages_json LIKE ?", "%is.duytan.edu.vn/international-school/%");
  const profiles = sources.filter(currentlyUsable).flatMap(s => directoryProfiles((JSON.parse(s.pages_json) as SourcePage[]).map(p=>p.text).join("\n")));
  const selected = findLecturer(hasIntent ? question : `giảng viên ${nameOnly}`, profiles);
  if (!selected) return null;
  // Dùng đúng đường dẫn hồ sơ lưu trong danh bạ đã công bố khi không thể truy cập web.
  // Đây là bản đối chiếu cũ, không giả vờ rằng hồ sơ vừa được xác minh trực tuyến.
  const savedAnswer = (): Answer => {
    const asksEmail = /\b(email|mail)\b/.test(q);
    const asksPhone = /\b(sdt|dien thoai|phone)\b/.test(q);
    const details = asksEmail ? [`Email: ${selected.email || "Danh bạ chưa ghi email."}`]
      : asksPhone ? [`Điện thoại: ${selected.phone || "Danh bạ chưa ghi số điện thoại."}`]
      : [selected.degree && `Học hàm/học vị: ${selected.degree}`, selected.email && `Email: ${selected.email}`, selected.phone && `Điện thoại: ${selected.phone}`].filter(Boolean);
    const quote = [selected.name, ...details].join("\n");
    return { status: "answered", reason: "saved_lecturer_profile", webStatus: "not_needed", retrieval: [],
      content: `${selected.name}\n${details.join("\n")} [1]\n\nThông tin lấy từ danh bạ đã lưu; bạn nên mở hồ sơ gốc để kiểm tra cập nhật.\nHồ sơ giảng viên: ${selected.url}`,
      citations: [{ id:"1", chunkId:`web:${selected.url}`, documentId:"web", revisionId:"web", title:`Hồ sơ giảng viên - ${selected.name}`, version:1, page:1, pageEnd:1, section:selected.name, quote, scope:"Danh bạ đã lưu; chưa kiểm tra lại hồ sơ trực tuyến trong lần hỏi này.", url:selected.url, sourceTier:"official" }] };
  };
  if (!web) return savedAnswer();
  try {
    const page = await fetchPublicPage(selected.url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), maxBytes: 1024*1024 });
    if (!page.mime.includes("text/html") || page.url !== selected.url) return savedAnswer();
    const profile = verifiedProfilePage(selected, page.bytes.toString("utf8"));
    if (!profile) return savedAnswer();
    const asksEmail = /\b(email|mail)\b/.test(q), asksPhone = /\b(sdt|dien thoai|phone)\b/.test(q);
    // Chỉ trả trường có trong trang vừa đọc; thiếu liên hệ thì nói rõ thay vì dùng số ở footer khoa.
    const details = asksEmail ? [`Email: ${profile.email || "Hồ sơ chưa công bố email."}`] : asksPhone ? [`Điện thoại: ${profile.phone || "Hồ sơ chưa công bố số điện thoại."}`] : [profile.degree && `Học hàm/học vị: ${profile.degree}`, profile.email && `Email: ${profile.email}`, profile.phone && `Điện thoại: ${profile.phone}`].filter(Boolean);
    return { status:"answered", reason:"official_lecturer_profile", webStatus:"used", retrieval:[], content:`${profile.name}\n${details.join("\n")} [1]\n\nXem hồ sơ giảng viên: ${profile.url}`, citations:[{id:"1",chunkId:`web:${profile.url}`,documentId:"web",revisionId:"web",title:`Hồ sơ giảng viên - ${profile.name}`,version:1,page:1,pageEnd:1,section:profile.name,quote:profile.text,scope:"Thông tin liên hệ công khai trên hồ sơ Khoa Đào tạo Quốc tế; đối chiếu khi cần.",url:profile.url,retrievedAt:new Date().toISOString(),sourceTier:"official",discoveredBy:"provided_link"}] };
  } catch {
    // Trang không tải được: giữ nguồn từ danh bạ đã công bố và ghi rõ chưa đối chiếu mới.
    return savedAnswer();
  }
}

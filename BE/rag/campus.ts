// Tra cứu nhanh địa chỉ đã được DTU công bố, không suy đoán số riêng của từng cơ sở.
import { normalize } from "./parser";
import type { Answer } from "./answer";

const proposal = "https://duytan.edu.vn/LoadPdf/StreamPdfFromUrl?url=639084763219022941-2026-ban-chinh-de-an-ts-thac-si.pdf";
const contact = "https://duytan.edu.vn/ContactUs";
const physical = "https://gdtcqp.duytan.edu.vn/lien-he";
const linkedCampus = "https://duytan.edu.vn/co-so-dao-tao-hanh-chinh/co-so-1-254-nguyen-van-linh-quan-thanh-khe-thanh-pho-da-nang-arc";
const campuses = [
  { keys: ["120 hoang minh thao", "hoa khanh"], label: "Cơ sở Hòa Khánh", address: "120 Hoàng Minh Thảo, Đà Nẵng", source: proposal, phone: "Trung tâm GDTC và QPAN tại cơ sở: 0236 365 0403 [2]", phoneSource: physical },
  { keys: ["254 nguyen van linh"], label: "Cơ sở 254 Nguyễn Văn Linh", address: "254 Nguyễn Văn Linh, Đà Nẵng", source: linkedCampus, phone: "Đại học Duy Tân: 0236 365 0403 hoặc 0236 382 7111 [2]", phoneSource: contact },
  { keys: ["209 phan thanh"], label: "Cơ sở 209 Phan Thanh", address: "209 Phan Thanh, Đà Nẵng", source: linkedCampus, phone: "Trung tâm Tư vấn tuyển sinh Khoa Đào tạo Quốc tế: 0236 710 9922, máy lẻ 137 [2]", phoneSource: "https://is.duytan.edu.vn/contact" },
  { keys: ["137 nguyen van linh"], label: "Cơ sở 137 Nguyễn Văn Linh", address: "137 Nguyễn Văn Linh, Đà Nẵng", source: proposal },
  { keys: ["k7/25 quang trung", "k7 25 quang trung"], label: "Cơ sở K7/25 Quang Trung", address: "K7/25 Quang Trung, Đà Nẵng", source: contact, phone: "Ban Đào tạo: 0236 224 3775 [2]", phoneSource: contact },
  { keys: ["03 quang trung", "3 quang trung"], label: "Cơ sở 03 Quang Trung", address: "03 Quang Trung, Đà Nẵng", source: contact, phone: "Văn phòng Đại học Duy Tân: 0236 382 7111 [2]", phoneSource: contact },
];
const maps = (address: string) => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("Đại học Duy Tân " + address);

type CampusTurn = { role: "user" | "assistant"; content: string };
const normalizeAddress = (text: string) => normalize(text)
    .replace(/\bn\.?\s*v\.?\s*l\.?\b/g, "nguyen van linh")
    .replace(/\bh\.?\s*m\.?\s*t\.?\b/g, "hoang minh thao")
    .replace(/\bq\.?\s*t\.?\b/g, "quang trung")
    .replace(/\bp\.?\s*t\.?\b/g, "phan thanh")
    .replace(/\s+/g, " ");
const findCampuses = (q: string) => campuses.filter(c => c.keys.some(k => new RegExp(`(?:^|[^a-z0-9])${k}(?=$|[^a-z0-9])`).test(q)));

export function campusAnswer(question: string, history: CampusTurn[] = []): Answer | null {
  // Mở rộng các chữ viết tắt đường phố chỉ khi có ranh giới từ rõ ràng.
  // Số nhà vẫn được giữ nguyên để không nhầm 254 và 137 Nguyễn Văn Linh.
  const q = normalizeAddress(question);
  let matches = findCampuses(q);
  const standaloneAddress = matches.length === 1 && /^(?:(?:co so|co so truong|truong)\s+)?(?:254 nguyen van linh|209 phan thanh|137 nguyen van linh|120 hoang minh thao)[?.! ]*$/.test(q.trim());
  const intent = /\b(chi duong|duong di|duong den|duong toi|di den|di sao|di nhu the nao|tim duong|dia chi|ban do|map|lien he|so dien thoai|hotline)\b/.test(q) || /\bco so\b.*\b(o dau|nam o dau)\b/.test(q) || standaloneAddress || (history.length > 0 && /^(?:nguyen van linh|phan thanh)[?.! ]*$/.test(q.trim()));
  if (!intent) return null;
  // Địa chỉ trong hình và đề án không thống nhất; yêu cầu xác nhận thay vì dẫn nhầm.
  if (/\b(?:78a|178a) phan van tri\b/.test(q))
    return { status: "clarification", reason: "campus_address_conflict", webStatus: "not_needed", retrieval: [], citations: [], content: "Địa chỉ Phan Văn Trị cần được xác minh: hình giới thiệu ghi 78A, trong khi đề án tuyển sinh DTU năm 2026 ghi 178A. Bạn vui lòng xác nhận với tổng đài DTU 0236 365 0403 trước khi đi: https://duytan.edu.vn/ContactUs" };
  // Chỉ nối lượt trước cho câu hỏi tiếp ngắn về đường đi/liên hệ, không kéo địa chỉ qua chủ đề mới.
  if (!matches.length && /^(?:con |vay |the )?(?:duong di|chi duong|di sao|ban do|lien he|so dien thoai|hotline)(?:\s+(?:thi sao|o dau|nhe|a))?[?.! ]*$/.test(q.trim())) {
    for (const turn of history.filter(t => t.role === "user").slice(-4).reverse()) {
      const previous = normalizeAddress(turn.content);
      const previousMatches = findCampuses(previous);
      if (previousMatches.length === 1) { matches = previousMatches; break; }
      if (!/^(?:(?:nguyen van linh|phan thanh)|(?:duong di|chi duong|di sao|ban do|lien he|so dien thoai|hotline)(?:\s+(?:thi sao|o dau|nhe|a))?)[?.! ]*$/.test(previous.trim())) break;
    }
  }
  // Một câu trả lời nhắc riêng tên đường có thể bổ sung ý cho địa chỉ cụ thể ngay trước đó.
  if (!matches.length && /^(?:nguyen van linh|phan thanh)[?.! ]*$/.test(q.trim())) {
    const previous = history.filter(t => t.role === "user").at(-1);
    const candidates = previous ? findCampuses(normalizeAddress(previous.content)) : [];
    if (candidates.length === 1 && candidates[0].keys.some(key => key.includes(q.trim()))) matches = candidates;
  }
  if (!matches.length && /\bnguyen van linh\b/.test(q) && !/\b\d+\b/.test(q))
    return { status:"clarification", reason:"ambiguous_campus", webStatus:"not_needed", retrieval:[], citations:[],
      content:"Bạn muốn tìm cơ sở 254 hay 137 Nguyễn Văn Linh? Bạn cho mình số nhà để chỉ đúng địa điểm nhé." };
  if (matches.length !== 1) return null;
  const c = matches[0];
  const source2 = c.phoneSource || contact;
  const phone = c.phone || "Chưa xác minh được số riêng của cơ sở. Liên hệ tổng đài DTU: 0236 365 0403 hoặc 0236 382 7111 [2]";
  return {
    status: "answered", reason: "official_campus_directory", webStatus: "not_needed", retrieval: [],
    content: `${c.label}: ${c.address}. [1]${c.source === linkedCampus ? "\n\nĐây là cùng cụm cơ sở 254 Nguyễn Văn Linh - 209 Phan Thanh; DTU cho biết có khối nhà nối liền hai địa chỉ. [1]" : ""}\n\nChỉ đường: ${maps(c.address)}\n\n${phone}\n\nBạn có thể chọn vị trí xuất phát trong Google Maps hoặc liên hệ cố vấn học tập để được hỗ trợ.`,
    citations: [
      { id:"1", chunkId:`web:${c.source}`, documentId:"web", revisionId:"web", title:"Thông tin cơ sở Đại học Duy Tân", version:1, page:1, pageEnd:1, section:"Địa chỉ", quote:c.source === linkedCampus ? "Cơ sở 254 Nguyễn Văn Linh & 209 Phan Thanh" : c.address, scope:"Thông tin công khai DTU", url:c.source, sourceTier:"official" },
      { id:"2", chunkId:`web:${source2}`, documentId:"web", revisionId:"web", title:"Thông tin liên hệ DTU", version:1, page:1, pageEnd:1, section:"Liên hệ", quote:phone.replace(" [2]", ""), scope:"Số điện thoại của đơn vị được ghi rõ", url:source2, sourceTier:"official" }
    ]
  };
}

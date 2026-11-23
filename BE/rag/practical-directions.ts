// Câu trả lời định hướng: giữ nguyên phạm vi của từng nguồn và nêu điểm cần xác nhận.
import { normalize } from "./parser";
import type { Answer } from "./answer";

export function practicalDirections(question: string): Answer | null {
  const q = normalize(question);
  if (/\bthu vien\b/.test(q) && /\b(o dau|dia chi|vi tri|nam o|den dau)\b/.test(q)) {
    const url = "https://sbe.duytan.edu.vn/library-services/19";
    return {status:"answered",reason:"library_locations",webStatus:"not_needed",retrieval:[],content:"Theo trang Trường Kinh tế & Kinh doanh DTU, thư viện được giới thiệu tại: phòng 607, 254 Nguyễn Văn Linh; phòng 601, 3 Quang Trung; và tòa F, Hòa Khánh Nam, Đà Nẵng. [1]\n\nTrang này không nêu ngày cập nhật; vị trí và phòng có thể đã thay đổi. Bạn nên liên hệ thư viện hoặc xem https://elib.duytan.edu.vn/ để xác nhận trước khi đến.",citations:[{id:"1",chunkId:`web:${url}`,documentId:"web",revisionId:"web",title:"Dịch vụ Thư viện DTU",version:1,page:1,pageEnd:1,section:"Địa điểm thư viện",quote:"Phòng 607, Số 254 Nguyễn Văn Linh; Phòng 601, Số 3 Quang Trung; Tòa nhà F, Hòa Khánh Nam",scope:"Thông tin được trang Trường Kinh tế & Kinh doanh công bố; cần xác nhận cập nhật",url,sourceTier:"official"}]};
  }
  if (/\bbao luu\b/.test(q) && /\b(don|nop|o dau|lam the nao|mau)\b/.test(q)) {
    const url = "https://is.duytan.edu.vn/is/bieu-mau/mau-don-cn-bl-th-hl";
    const pdf = "https://files01.duytan.edu.vn/svruploads/is-duytan/638961140798980768-2.Don-xin-Bao-luu.pdf";
    return {status:"answered",reason:"leave_form_direction",webStatus:"not_needed",retrieval:[],content:`Bạn có thể tải mẫu đơn bảo lưu từ trang biểu mẫu của Khoa Đào tạo Quốc tế DTU: ${url} [1]\nTải trực tiếp mẫu PDF: ${pdf}\n\nTheo hướng dẫn trên trang khoa, sinh viên điền đơn, xin xác nhận của phụ huynh và cố vấn học tập, sau đó gửi đơn đến Phòng Tổng hợp của trường đào tạo chủ quản. [1] Hãy xác nhận quy trình và thời điểm nộp hiện hành với khoa hoặc cố vấn trước khi thực hiện.`,citations:[{id:"1",chunkId:`web:${url}`,documentId:"web",revisionId:"web",title:"Biểu mẫu bảo lưu - Khoa Đào tạo Quốc tế",version:1,page:1,pageEnd:1,section:"Quy trình bảo lưu và biểu mẫu",quote:"Gửi đơn đã đủ chữ ký xác nhận đến Phòng Tổng hợp thuộc Trường đào tạo chủ quản.",scope:"Hướng dẫn công bố trên website Khoa Đào tạo Quốc tế; cần xác nhận thời điểm áp dụng",url,sourceTier:"official"}]};
  }
  return null;
}

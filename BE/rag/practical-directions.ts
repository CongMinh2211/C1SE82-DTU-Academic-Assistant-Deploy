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
    const url = "https://ktiengtrung.duytan.edu.vn/bieu-mau/mau-don-xin-bao-luu-ket-qua-hoc-tap-cei";
    return {status:"answered",reason:"leave_form_direction",webStatus:"not_needed",retrieval:[],content:"Bạn có thể xem và tải mẫu đơn xin bảo lưu tại trang biểu mẫu của Khoa Tiếng Trung DTU. [1] Đây là nguồn của một khoa, không mặc định áp dụng nguyên trạng cho mọi chương trình.\n\nĐể biết nơi nộp và giấy tờ hiện hành của bạn, hãy hỏi cố vấn học tập hoặc văn phòng khoa quản lý; trang mẫu này không xác nhận nơi nộp chung cho toàn trường.",citations:[{id:"1",chunkId:`web:${url}`,documentId:"web",revisionId:"web",title:"Mẫu đơn xin bảo lưu kết quả học tập",version:1,page:1,pageEnd:1,section:"Biểu mẫu",quote:"Mẫu đơn xin bảo lưu kết quả học tập; tệp đính kèm: Đơn xin Bảo lưu.pdf",scope:"Biểu mẫu trên website Khoa Tiếng Trung; cần xác nhận nơi nộp và quy định hiện hành",url,sourceTier:"official"}]};
  }
  return null;
}

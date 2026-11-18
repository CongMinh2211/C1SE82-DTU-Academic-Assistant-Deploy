// Danh bạ được chọn từ trang chính thức của từng đơn vị; không suy đoán đơn vị quản lý ngành.
import { normalize } from "./parser";
import type { Answer } from "./answer";
export const faculties = [
  { keys:["khoa dao tao quoc te", "khoa quoc te"], name:"Khoa Đào tạo Quốc tế", place:"P.601, 254 Nguyễn Văn Linh; trang khoa cũng liệt kê P.204–205 nhà G, 120 Hoàng Minh Thảo", phone:"0236 710 9922, máy lẻ 137", email:"intlschool@duytan.edu.vn", url:"https://is.duytan.edu.vn/contact" },
  { keys:["khoa kinh te tai chinh"], name:"Khoa Kinh tế - Tài chính", place:"Phòng 301, 254 Nguyễn Văn Linh", phone:"0236 365 0403, máy lẻ 129 hoặc 405", email:"kkinhtetaichinh@duytan.edu.vn", url:"https://kkttc.duytan.edu.vn/contact" },
  { keys:["khoa my thuat ung dung"], name:"Khoa Mỹ thuật Ứng dụng", place:"Phòng 101C, khu B, 120 Hoàng Minh Thảo", phone:"0236 710 9922, máy lẻ 142", email:"khoamtud@duytan.edu.vn", url:"https://khoamtud.duytan.edu.vn/lien-he" },
  { keys:["khoa duoc"], name:"Khoa Dược", place:"Phòng 201, nhà C, 120 Hoàng Minh Thảo", phone:"0236 710 9922, máy lẻ 302", email:"khoaduoc@duytan.edu.vn", url:"https://cmp.duytan.edu.vn/khoa-duoc-1ea/gioi-thieu-khoa-duoc-x2s" },
  { keys:["khoa y"], name:"Khoa Y", place:"Phòng 402, nhà F, 120 Hoàng Minh Thảo", phone:"0236 382 7111, máy lẻ 402", url:"https://med.duytan.edu.vn/tong-quan-j57/khoa-y-truong-dai-hoc-duy-tanbht9i" },
  { keys:["khoa rang ham mat"], name:"Khoa Răng - Hàm - Mặt", place:"Phòng 412, nhà F, 120 Hoàng Minh Thảo", phone:"0236 382 7111, máy lẻ 412", url:"https://cmp.duytan.edu.vn/khoa-rang-ham-mat-32m/gioi-thieu-ve-khoa-rang-ham-mat-truong-dai-ho" },
  { keys:["khoa kien truc"], name:"Khoa Kiến trúc", place:"Phòng 405D, 120 Hoàng Minh Thảo", phone:"0236 382 7111, máy lẻ 203; hotline khoa: 0931 860 768", email:"khoakientruc@duytan.edu.vn", url:"https://kkientruc.duytan.edu.vn/lien-he/" },
  { keys:["khoa quan tri kinh doanh"], name:"Khoa Quản trị Kinh doanh", place:"Phòng 201, 254 Nguyễn Văn Linh", phone:"0236 365 0403, máy lẻ 128", email:"khoaquantrikinhdoanh@duytan.edu.vn", url:"https://kqtkd.duytan.edu.vn/lien-he" },
  { keys:["khoa tieng trung"], name:"Khoa Tiếng Trung", place:"Phòng 702, tầng 7, 254 Nguyễn Văn Linh", phone:"0236 365 0403, máy lẻ 621", email:"khoatiengtrung@duytan.edu.vn", url:"https://ktiengtrung.duytan.edu.vn/contact" },
];
export function facultyDirectoryAnswer(question: string): Answer | null {
  const q = normalize(question);
  if (!/\b(lien he|dia chi|phong|van phong|co so|o dau|dien thoai|so dien thoai|hotline|email|chi duong|tim duong)\b/.test(q)) return null;
  // Câu hỏi về một giảng viên phải tìm đúng người, không thay bằng số chung của khoa.
  if (/\b(thay|co|giang vien|giang day|giao vien)\b/.test(q)) return null;
  const matches = faculties.filter(f => f.keys.some(k => q.includes(k)));
  if (matches.length !== 1) return null;
  const f = matches[0];
  // Mỗi địa chỉ là một điểm đến độc lập, không đưa cả hai cơ sở vào cùng một truy vấn.
  const addresses = f.keys.includes("khoa dao tao quoc te")
    ? ["254 Nguyễn Văn Linh, Đà Nẵng", "120 Hoàng Minh Thảo, Đà Nẵng"]
    : [f.place + ", Đà Nẵng"];
  const maps = addresses.map((address) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Đại học Duy Tân " + address));
  const email = "email" in f && f.email ? `\nEmail: ${f.email}` : "";
  return { status:"answered", reason:"official_faculty_contact", webStatus:"not_needed", retrieval:[],
    content:`${f.name}\nVăn phòng: ${f.place}, Đà Nẵng.\nĐiện thoại: ${f.phone}.${email} [1]\n\n${maps.map((map, i) => `Bản đồ ${addresses[i]}: ${map}`).join("\n")}\n\nVị trí và số máy lẻ có thể thay đổi; bạn nên gọi khoa để xác nhận trước khi đến.`,
    citations:[{id:"1",chunkId:`web:${f.url}`,documentId:"web",revisionId:"web",title:`Liên hệ ${f.name}`,version:1,page:1,pageEnd:1,section:"Liên hệ",quote:`${f.place}; ${f.phone}`,scope:"Thông tin công khai của đơn vị DTU",url:f.url,sourceTier:"official"}] };
}

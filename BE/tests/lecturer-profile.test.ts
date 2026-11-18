// Kiểm thử tra đúng tên và link hồ sơ; không suy ra địa chỉ liên hệ từ tên giảng viên.
import test from "node:test";
import assert from "node:assert/strict";
import { directoryProfiles, findLecturer, verifiedProfilePage } from "../rag/lecturer-profile";
import { lecturerProfileAnswer } from "../rag/lecturer-profile";
test("hồ sơ thầy Trịnh Đình Thanh trỏ đúng nguồn chính thức", async () => {
  const result = await lecturerProfileAnswer("biết thầy Trịnh Đình Thanh không", false);
  assert.equal(result?.status, "answered");
  assert.match(result!.content, /trinhdinhthanh@duytan\.edu\.vn/);
  assert.equal(result!.citations[0].url, "https://xhnv.duytan.edu.vn/nhan-su/33-trinh-dinh-thanh");
});
const url="https://is.duytan.edu.vn/international-school/27-tran-kim-sanh";
const profiles=directoryProfiles(`Họ tên: Trần Kim Sanh\nEmail: old@example.test\nNguồn gốc: ${url}\n\nHọ tên: Nguyễn Đức Mận\nNguồn gốc: https://is.duytan.edu.vn/international-school/1-nguyen-duc-man`);
test("tên đầy đủ, tên ngắn và không dấu dẫn đến cùng hồ sơ Sanh",()=>{
  for(const q of ["Email thầy Trần Kim Sanh","thông tin thầy sanh","so dien thoai thay Sanh","hồ sơ thầy Trần Kim Sanh"]) assert.equal(findLecturer(q,profiles)?.url,url);
});
test("trùng tên hoặc không đúng họ tên thì không chọn đại giảng viên",()=>{
  assert.equal(findLecturer("Email thầy Nguyễn Văn Sanh",profiles),null);
  assert.equal(findLecturer("thông tin thầy Sanh",[...profiles,{name:"Nguyễn Sanh",url:"https://is.duytan.edu.vn/international-school/999-nguyen-sanh"}]),null);
});
test("yêu cầu soạn email không bị biến thành tra danh bạ",()=>{
  assert.equal(findLecturer("Viết email thầy Trần Kim Sanh",profiles),null);
});
test("hồ sơ không được nhận URL ngoài host hoặc URL do nội dung giả mạo ghép thêm",()=>{
  assert.deepEqual(directoryProfiles("Họ tên: Trần Kim Sanh\nNguồn gốc: https://is.duytan.edu.vn.evil.test/international-school/27-tran-kim-sanh"),[]);
  assert.deepEqual(directoryProfiles(`Họ tên: Trần Kim Sanh\nNguồn gốc: ${url}?redirect=https://evil.test`),[]);
});
test("chỉ lấy email và điện thoại gắn nhãn cá nhân, không lấy footer khoa",()=>{
  const html="<html><title>Trần Kim Sanh - DTU</title><main><div><h2>Trần  Kim Sanh</h2><p>Học hàm/Học vị: Thạc sĩ</p><p>Số Điện thoại: 0987 409 464</p><p>Email: trankimsanh@dtu.edu.vn</p></div></main><footer>intlschool@duytan.edu.vn</footer></html>";
  const value=verifiedProfilePage(profiles[0],html);
  assert.equal(value?.email,"trankimsanh@dtu.edu.vn");
  assert.equal(value?.phone,"0987 409 464");
  assert.equal(verifiedProfilePage(profiles[1],html),null);
});

test("mỗi họ tên đầy đủ trong danh bạ đều trỏ đúng hồ sơ của chính người đó", async () => {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile("knowledge/pending-review/international-capstone/international-school-directory.txt", "utf8");
  const directory = directoryProfiles(text);
  assert.ok(directory.length > 0);
  for (const profile of directory) {
    assert.equal(findLecturer(`thông tin giảng viên ${profile.name}`, directory)?.url, profile.url, profile.name);
  }
});
test("tên đầy đủ ưu tiên hơn các từ thường gặp trong câu hỏi", () => {
  const directory = [
    { name: "Lê Thị Khánh Ly", url: "https://is.duytan.edu.vn/international-school/101-le-thi-khanh-ly" },
    { name: "Lê Thị Khánh", url: "https://is.duytan.edu.vn/international-school/102-le-thi-khanh" },
  ];
  assert.equal(findLecturer("thông tin giảng viên Lê Thị Khánh Ly", directory)?.name, "Lê Thị Khánh Ly");
});

test("tên Diệu được ưu tiên theo tên gọi cuối, không nhầm Diệu Tâm", () => {
  const directory = [
    { name: "Huỳnh Bá Diệu", url: "https://is.duytan.edu.vn/international-school/70-huynh-ba-dieu" },
    { name: "Mai Thị Diệu Tâm", url: "https://is.duytan.edu.vn/international-school/85-mai-thi-dieu-tam" },
  ];
  assert.equal(findLecturer("Thông tin thầy diệu", directory)?.name, "Huỳnh Bá Diệu");
});


test("không lấy email hoặc điện thoại của khoa khi hồ sơ giảng viên thiếu",()=>{
  const html="<title>Trần Kim Sanh</title><main><div><h2>Trần Kim Sanh</h2><p>Vị trí: Giảng viên</p></div><div>Email: intlschool@duytan.edu.vn<br>Số Điện thoại: 0236 710 9922</div></main>";
  const value=verifiedProfilePage(profiles[0],html);
  assert.equal(value?.email,undefined);
  assert.equal(value?.phone,undefined);
});


test("không nhầm chức vụ là học vị và nhận số quốc tế có ngoặc",()=>{
  const html="<div><h2>Trần Kim Sanh</h2><p>Học hàm/Học vị: </p><p>Chức vụ: Chuyên viên</p><p>Số Điện thoại: (+84) 383 859 502</p></div>";
  const value=verifiedProfilePage(profiles[0],html);
  assert.equal(value?.degree,undefined);
  assert.equal(value?.phone,"(+84) 383 859 502");
});

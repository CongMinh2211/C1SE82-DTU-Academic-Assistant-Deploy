import { readFile } from "node:fs/promises";
import path from "node:path";

// Nhập PDF gốc vào local để mỗi trích dẫn vẫn trỏ đúng số trang trong tài liệu.
const origin = "http://localhost:3000";
const account = JSON.parse(await readFile("config/accounts.json", "utf8")).production.admin;
const login = await fetch(origin + "/api/auth/sign-in/email", {method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(account)});
if (!login.ok) throw Error("Không đăng nhập được quản trị local.");
const cookie = login.headers.getSetCookie().map(x => x.split(";")[0]).join("; ");
const headers = {Origin:origin,Cookie:cookie};
const title = "Hướng dẫn sử dụng myDTU cho sinh viên - 2021";
const listResponse = await fetch(origin + "/api/app/admin/documents", {headers});
if (!listResponse.ok) throw Error("Không đọc được kho tài liệu.");
const documents = await listResponse.json();
const current = documents.find(d => d.title === title);
if (!current) {
  const filename = path.resolve("../Huong Dan Su dung myDTU - Cho Sinh Vien.pdf");
  const form = new FormData(); form.set("title",title); form.set("topic","Hướng dẫn myDTU");
  form.set("scope","Hướng dẫn myDTU của Phòng Đào tạo, năm 2021, 52 trang. Giao diện, liên hệ và quy trình có thể thay đổi; đối chiếu hệ thống và thông báo hiện hành. Nội dung hình ảnh chưa được OCR.");
  form.set("file",new Blob([await readFile(filename)],{type:"application/pdf"}),"huong-dan-mydtu-2021.pdf");
  const upload = await fetch(origin+"/api/app/admin/documents/upload",{method:"POST",headers,body:form});
  if (!upload.ok) throw Error("Không tải được tài liệu: HTTP " + upload.status);
  console.log(JSON.stringify(await upload.json()));
} else {
  console.log(JSON.stringify({id:current.id,revision:current.latest_revision,status:current.status,active:!!current.active_revision}));
  if (current.status === "ready" && !current.active_revision) {
    const res = await fetch(`${origin}/api/app/admin/documents/${current.id}/publish`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({revisionId:current.latest_revision})});
    if(!res.ok) throw Error("Không xuất bản được tài liệu: HTTP " + res.status);
    console.log("Đã xuất bản bản hướng dẫn năm 2021 vào kho local.");
  }
}

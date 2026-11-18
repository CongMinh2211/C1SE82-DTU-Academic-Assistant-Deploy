import { readFile } from "node:fs/promises";
const origin = "http://localhost:3000";
const account = JSON.parse(await readFile("config/accounts.json", "utf8")).production.admin;
const login = await fetch(origin + "/api/auth/sign-in/email", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(account) });
if (!login.ok) throw Error("Không đăng nhập được admin local");
const cookie = login.headers.getSetCookie().map(x => x.split(";")[0]).join("; ");
const headers = { Origin: origin, Cookie: cookie };
const title = "Trích dẫn hướng dẫn nộp học phí và VietinBank - cần đối chiếu";
const existing = await (await fetch(origin + "/api/app/admin/documents", { headers })).json();
let item = existing.find(x => x.title === title);
if (!item) {
  const form = new FormData(); form.set("title", title); form.set("topic", "Học phí"); form.set("scope", "Trích từ tài liệu nhóm cung cấp; VietinBank năm 2022, tài liệu Word chưa rõ ngày. Cần đối chiếu quy định và tài khoản theo học kỳ hiện tại.");
  form.set("file", new Blob([await readFile("knowledge/pending-review/tuition-payment/trich-dan-huong-dan-thanh-toan.txt")], {type:"text/plain"}), "trich-dan-huong-dan-thanh-toan.txt");
  const response = await fetch(origin + "/api/app/admin/documents/upload", {method:"POST", headers, body:form});
  if (!response.ok) throw Error("Upload thất bại: " + response.status);
  const created = await response.json(); console.log(JSON.stringify(created));
} else {
  if (process.argv.includes("--update")) {
    const form = new FormData(); form.set("title",title); form.set("topic","Học phí"); form.set("documentId",item.id);
    form.set("scope","Trích tài liệu nhóm cung cấp; VietinBank 2022, tài liệu Word chưa rõ ngày. Đối chiếu thông báo học kỳ hiện tại trước khi nộp.");
    form.set("file",new Blob([await readFile("knowledge/pending-review/tuition-payment/trich-dan-huong-dan-thanh-toan.txt")],{type:"text/plain"}),"trich-dan-huong-dan-thanh-toan.txt");
    const updated=await fetch(origin+"/api/app/admin/documents/upload",{method:"POST",headers,body:form});
    if (!updated.ok) throw Error("Cập nhật thất bại: HTTP "+updated.status);
    console.log(JSON.stringify(await updated.json()));
  }
  console.log(JSON.stringify({documentId:item.id, revisionId:item.latest_revision, status:item.status}));
  if (!process.argv.includes("--update") && item.status === "ready" && item.active_revision !== item.latest_revision) {
    const response = await fetch(`${origin}/api/app/admin/documents/${item.id}/publish`, {method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({revisionId:item.latest_revision})});
    if (!response.ok) throw Error("Xuất bản trích dẫn thất bại: " + response.status);
    console.log("Đã xuất bản bản trích dẫn có ghi phạm vi, không xuất bản tài liệu gốc chưa rà soát.");
  }
}

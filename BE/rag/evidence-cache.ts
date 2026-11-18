import { createHash } from "node:crypto";

// Cache ngắn trong từng tiến trình, khóa được băm để không giữ nguyên câu hỏi của sinh viên.
export class EvidenceCache<T> {
  private entries = new Map<string,{expires:number,value:Promise<T>}>();
  constructor(private limit=128, private ttlMs=60_000) {}
  async get(question:string, fingerprint:unknown, calculate:()=>Promise<T>):Promise<T> {
    // Ghép câu hỏi với dấu vân tay của dữ liệu nguồn rồi băm; thay nguồn tạo khóa mới.
    const key=createHash("sha256").update(JSON.stringify([question,fingerprint])).digest("hex");
    const old=this.entries.get(key);
    // Trả bản sao để người gọi không thể sửa kết quả dùng chung với yêu cầu khác.
    if(old && old.expires>Date.now()) return structuredClone(await old.value);
    this.entries.delete(key);
    // Lưu Promise ngay khi bắt đầu để các yêu cầu giống nhau chờ chung một lần tính.
    const value=Promise.resolve().then(calculate);
    this.entries.set(key,{expires:Date.now()+this.ttlMs,value});
    // Giới hạn số phần tử trong RAM; Map giữ thứ tự thêm nên xóa khóa cũ nhất trước.
    while(this.entries.size>this.limit) this.entries.delete(this.entries.keys().next().value!);
    try { return structuredClone(await value); }
    // Chỉ xóa Promise bị lỗi nếu chưa có lần tính mới thay nó; chuyển lỗi cho bên gọi.
    catch(error) { if(this.entries.get(key)?.value===value) this.entries.delete(key); throw error; }
  }
}

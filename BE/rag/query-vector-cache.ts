import { createHash } from "node:crypto";

// Cache vector câu hỏi riêng; cache nguồn và FAQ có kiểm tra phiên bản tại evidence-cache.
export class QueryVectorCache {
  // Map lưu theo thứ tự chèn để loại mục cũ nhất khi vượt dung lượng cho phép.
  private entries = new Map<
    string,
    { expires: number; value: Promise<number[]> }
  >();
  constructor(
    // Mặc định chỉ giữ 256 câu hỏi khác nhau trong mỗi tiến trình.
    private limit = 256,
    // Thời hạn năm phút tính từ khi bắt đầu tính vector, không được gia hạn khi đọc lại.
    private ttlMs = 5 * 60_000,
  ) {}
  async get(question: string, calculate: () => Promise<number[]>) {
    // Hash tránh giữ nguyên văn câu hỏi làm khóa; cache này vẫn chỉ nằm trong RAM.
    const key = createHash("sha256").update(question).digest("hex");
    // Lấy cả promise đang tính để các lượt hỏi trùng có thể chờ cùng một phép embedding.
    const previous = this.entries.get(key);
    // Chỉ dùng mục chưa hết hạn; sao chép vector để caller không sửa mảng trong cache.
    if (previous && previous.expires > Date.now())
      return [...(await previous.value)];
    // Xóa mục hết hạn trước khi chèn để vị trí trong Map phản ánh lần tạo mới.
    this.entries.delete(key);
    // calculate được cung cấp bởi retrieve, thường gọi embedTexts cho một câu hỏi.
    const value = calculate();
    // Lưu promise ngay, trước khi await, để các lời gọi đồng thời thấy cùng một công việc.
    this.entries.set(key, { expires: Date.now() + this.ttlMs, value });
    // Giới hạn số mục giúp cache không tăng mãi khi sinh viên hỏi nhiều câu khác nhau.
    while (this.entries.size > this.limit)
      // keys().next() là khóa được chèn sớm nhất còn tồn tại.
      this.entries.delete(this.entries.keys().next().value!);
    try {
      // Trả bản sao sau khi tính xong; không chia sẻ mảng mutable với code bên ngoài.
      return [...(await value)];
    } catch (error) {
      // Xóa đúng promise bị lỗi; không xóa lượt tính mới hơn cho cùng câu hỏi.
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      // Đẩy lỗi lên retrieve để luồng chat quyết định cách thông báo dịch vụ không khả dụng.
      throw error;
    }
  }
}

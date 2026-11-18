// Mỗi thành phần sở hữu yêu cầu của riêng mình, không chia sẻ kết quả giữa các phiên người dùng.
export class ResourceRequest<T> {
  // pending giữ đúng yêu cầu đang chạy; null nghĩa là lần đọc tiếp được phép gọi API.
  private pending: Promise<T> | null = null;
  // Mỗi lượt gọi API có bộ điều khiển riêng để hủy khi component unmount.
  private controller: AbortController | null = null;
  // Cờ này chỉ chuyển từ false sang true; một instance đã dispose không được dùng lại.
  private disposed = false;

  constructor(
    // key gắn instance với bộ lọc/đường dẫn tại thời điểm component tạo yêu cầu.
    readonly key: string,
    // Callback nhận signal; lớp này không biết HTTP endpoint hay dữ liệu cụ thể.
    private readonly fetchValue: (signal: AbortSignal) => Promise<T>,
  ) {}

  get active() {
    // Component kiểm tra active trước khi setState để tránh ghi kết quả của trang đã đóng.
    return !this.disposed;
  }

  read(): Promise<T> {
    // Sau khi giao diện bị tháo, không tạo yêu cầu mới để tránh cập nhật trạng thái cũ.
    if (this.disposed)
      return Promise.reject(
        new DOMException("Resource disposed", "AbortError"),
      );
    // Hai lượt đọc đồng thời cùng dùng một promise, tránh gửi trùng lên API.
    if (this.pending) return this.pending;
    // Tạo controller khi thật sự bắt đầu lượt mới, không thay controller của lượt dùng chung.
    this.controller = new AbortController();
    // Giữ signal trong biến cục bộ để callback luôn dùng đúng lượt gọi này.
    const signal = this.controller.signal;
    // Đưa callback vào promise để lỗi đồng bộ cũng được xử lý như lỗi bất đồng bộ.
    this.pending = Promise.resolve()
      // Chỉ gọi fetchValue một lần; các caller khác nhận cùng pending.
      .then(() => this.fetchValue(signal))
      .finally(() => {
        // Xóa promise sau cả thành công và thất bại để lượt đọc sau lấy dữ liệu mới.
        this.pending = null;
      });
    // Trả promise cho component tự xử lý loading, kết quả hoặc lỗi.
    return this.pending;
  }

  async refresh(): Promise<T> {
    // Chờ lượt đọc cũ kết thúc trước khi lấy ảnh chụp mới sau thao tác sửa dữ liệu.
    if (this.pending) await this.pending.catch(() => undefined);
    // Lỗi của lượt cũ không ngăn yêu cầu refresh mới; read sẽ khởi tạo lượt tiếp theo.
    return this.read();
  }

  dispose() {
    // Ngăn yêu cầu đang chờ tiếp tục cập nhật thành phần đã bị tháo.
    this.disposed = true;
    // Optional chaining cho phép dispose an toàn ngay cả trước lần read đầu tiên.
    this.controller?.abort();
  }
}

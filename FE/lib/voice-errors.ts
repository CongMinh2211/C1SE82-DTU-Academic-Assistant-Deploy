// Phân biệt quyền micro, dịch vụ nhận diện và thiết bị để hướng dẫn đúng nguyên nhân.
export function speechErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      return "Không thể dùng micro. Kiểm tra quyền của trang, quyền micro Windows và tải lại trang.";
    case "service-not-allowed":
      return "Dịch vụ nhận diện giọng nói không khả dụng trên trình duyệt này. Hãy thử Chrome hoặc Edge thông thường.";
    case "audio-capture":
      return "Không tìm thấy micro hoạt động. Kiểm tra thiết bị đầu vào trong cài đặt Windows.";
    case "network":
      return "Không kết nối được dịch vụ nhận diện giọng nói. Kiểm tra mạng và thử lại.";
    case "no-speech":
      return "Chưa nghe thấy giọng nói. Hãy kiểm tra micro và thử lại.";
    case "language-not-supported":
      return "Ngôn ngữ này chưa được dịch vụ giọng nói hỗ trợ. Hãy thử ngôn ngữ hoặc trình duyệt khác.";
    default:
      return "Không nhận diện được giọng nói. Hãy thử lại hoặc nhập bằng bàn phím.";
  }
}

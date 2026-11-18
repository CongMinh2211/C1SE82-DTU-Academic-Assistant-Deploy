// Mục đích file: Chọn cấu hình nhà cung cấp AI và thứ tự dự phòng từ biến môi trường phía máy chủ.
import { requiredEnv } from "../config";

export function academicModel() {
  // Mỗi nhà cung cấp dùng key riêng ở máy chủ, không gửi key sang trình duyệt.
  const providers: {
    id: string;
    model: { id: `custom/${string}`; url: string; apiKey: string; api: "chat" };
    maxRetries: number;
    modelSettings: { timeout: { stepMs: number } };
  }[] = [];
  const add = (
    name: string,
    key: string | undefined,
    model: string,
    url: string,
  ) => {
    // Nhà cung cấp không có khóa sẽ không được thêm vào danh sách thử.
    if (key?.trim())
      providers.push({
        id: name,
        model: { id: `custom/${model}`, url, apiKey: key, api: "chat" },
        maxRetries: 0,
        modelSettings: { timeout: { stepMs: 15000 } },
      });
  };
  // Mỗi dịch vụ có endpoint và model riêng; giá trị mặc định có thể đổi bằng môi trường.
  const openai = () =>
    add(
      "openai",
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || "gpt-4.1-mini",
      "https://api.openai.com/v1",
    );
  const gemini = () =>
    add(
      "gemini",
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
      "https://generativelanguage.googleapis.com/v1beta/openai",
    );
  // Thứ tự mảng quyết định dịch vụ chính và dịch vụ dự phòng khi lời gọi thất bại.
  if (process.env.AI_PRIMARY_PROVIDER === "openai") {
    openai();
    gemini();
  } else {
    gemini();
    openai();
  }
  // Giữ cấu hình cũ nếu chưa thiết lập nhà cung cấp trực tiếp nào.
  if (!providers.length)
    add(
      "savegate",
      requiredEnv("SAVEGATE_API_KEY"),
      process.env.SAVEGATE_MODEL || "gpt-5.4",
      process.env.SAVEGATE_BASE_URL || "https://api.savegate.ai/v1",
    );
  // Cấu hình cũ có thời gian chờ dài hơn để tương thích cách vận hành hiện tại.
  if (providers[0]?.id === "savegate") providers[0].modelSettings.timeout.stepMs = 60000;
  return providers;
}

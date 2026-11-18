// Mục đích file: Gọi nhà cung cấp tìm kiếm web được cấu hình và chuyển kết quả về định dạng nội bộ.
// Dùng SHA-256 để tạo mã phiên ổn định từ tên miền ứng dụng, không gửi khóa bí mật.
import { createHash } from "node:crypto";
// Client và transport thiết lập kết nối MCP tới dịch vụ tìm kiếm Parallel.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
// Zod kiểm tra kết quả bên ngoài trước khi hệ thống sử dụng dữ liệu.
import { z } from "zod";
import { appUrl } from "./config";

// Một kết quả phải có URL hợp lệ; tên và đoạn trích có thể không có.
// Giới hạn 100 phần tử để tránh xử lý danh sách quá lớn từ dịch vụ bên ngoài.
const searchResult = z.object({
  results: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        excerpts: z.array(z.string()).optional(),
      }),
    )
    .max(100),
});

async function connect(signal: AbortSignal) {
  // Tạo thông tin định danh cho client MCP, không phải tài khoản người dùng.
  const client = new Client({
    name: "dtu-academic-assistant",
    version: "1.0.0",
  });
  try {
    // Truyền tín hiệu hủy và giới hạn thời gian để yêu cầu không chờ vô hạn.
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL("https://search.parallel.ai/mcp"),
        {
          requestInit: { signal },
        },
      ),
      { signal, timeout: 12000 },
    );
    // Chỉ tiếp tục nếu dịch vụ thực sự công bố công cụ tìm kiếm web.
    const tools = await client.listTools({}, { signal, timeout: 12000 });
    if (!tools.tools.some((tool) => tool.name === "web_search"))
      throw new Error("Search tool unavailable");
    return client;
  } catch (error) {
    // Khi kết nối hoặc kiểm tra công cụ thất bại, đóng client rồi báo lỗi cho nơi gọi.
    await client.close().catch(() => {});
    throw error;
  }
}
export async function parallelSearchReady(signal: AbortSignal) {
  // Thử kết nối và đóng ngay để kiểm tra dịch vụ có sẵn hay không.
  const client = await connect(signal);
  await client.close();
  return true;
}
export async function parallelSearch(query: string, signal: AbortSignal) {
  // Mỗi lần tìm sử dụng một client riêng và luôn đóng client ở khối finally.
  const client = await connect(signal);
  try {
    // Gửi câu hỏi dưới dạng mục tiêu và truy vấn tìm kiếm, kèm mã phiên ổn định.
    const result = await client.callTool(
      {
        name: "web_search",
        arguments: {
          objective: query,
          // Parallel yêu cầu truy vấn từ khóa không đặt cụm từ trong dấu nháy.
          search_queries: [query.replace(/["“”]/g, "")],
          // Không đổi mã phiên để né giới hạn lượt dùng của nhà cung cấp.
          session_id: createHash("sha256")
            .update(new URL(appUrl).hostname)
            .digest("hex"),
          model_name: process.env.SAVEGATE_MODEL || "gpt-5.4",
        },
      },
      undefined,
      { signal, timeout: 25000 },
    );
    // Phân biệt phản hồi lỗi của công cụ với dữ liệu tìm kiếm hợp lệ.
    if (result.isError) throw new Error("Search unavailable or rate limited");
    const content = z
      .array(z.object({ type: z.string(), text: z.string().optional() }))
      .parse(result.content);
    // Chỉ ghép các phần văn bản; các kiểu nội dung khác không được xem là JSON.
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n");
    // Chặn nội dung quá lớn trước khi phân tích JSON để giảm nguy cơ quá tải.
    if (text.length > 2_000_000) throw new Error("Search response too large");
    const data = searchResult.parse(
      result.structuredContent || JSON.parse(text),
    );
    // Giới hạn 24 kết quả và gán điểm theo thứ tự; đoạn trích chỉ dùng để tìm nguồn.
    // Bộ đọc khác sẽ tải trang gốc để kiểm chứng, không coi đoạn trích là bằng chứng cuối cùng.
    return data.results.slice(0, 24).map((item, index) => ({
      url: item.url,
      title: item.title || "",
      snippet: (item.excerpts || []).join("\n"),
      score: 24 - index,
    }));
  } finally {
    // Đóng kết nối cả khi xử lý thành công, bị hủy hoặc gặp lỗi.
    await client.close();
  }
}

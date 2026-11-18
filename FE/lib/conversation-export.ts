import type { Conversation } from "./contracts";

export function conversationText(conversation: Conversation) {
  const blocks = [
    "DTU ACADEMIC ASSISTANT",
    `Hội thoại: ${conversation.title}`,
    `Mã: ${conversation.id}`,
    `Tạo lúc: ${conversation.created_at}`,
    `Cập nhật: ${conversation.updated_at}`,
  ];
  for (const message of conversation.messages || []) {
    blocks.push(
      "\n" + "=".repeat(56),
      `${message.role === "user" ? "SINH VIÊN" : "TRỢ LÝ"} • ${message.created_at}`,
      message.content,
    );
    if (message.citations.length) blocks.push("\nNGUỒN CỦA CÂU TRẢ LỜI NÀY");
    for (const c of message.citations)
      blocks.push(
        [
          `[${c.id}] ${c.title}`,
          c.documentId === "web"
            ? `URL: ${c.url || "Không có"}`
            : `Tài liệu ${c.documentId} • Phiên bản ${c.version} • Trang ${c.page}${c.pageEnd > c.page ? `–${c.pageEnd}` : ""} • Mục ${c.section}`,
          c.retrievedAt && `Truy xuất: ${c.retrievedAt}`,
          c.publishedAt && `Ngày đăng: ${c.publishedAt}`,
          c.assessment && `Đánh giá nguồn: ${c.assessment}`,
          `Phạm vi: ${c.scope}`,
          "Đoạn nguồn nguyên văn:",
          c.quote,
        ]
          .filter(Boolean)
          .join("\n"),
      );
  }
  return blocks.join("\n\n") + "\n";
}

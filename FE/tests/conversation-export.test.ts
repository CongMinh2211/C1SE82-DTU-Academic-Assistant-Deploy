// Mục đích file: Kiểm thử: Nội dung xuất hội thoại và thông tin xuất xứ nguồn đi kèm.
import test from "node:test";
import assert from "node:assert/strict";
import { conversationText } from "../../FE/lib/conversation-export";
import type { Conversation } from "../../FE/lib/contracts";
// File TXT phải giữ các lượt chat và thông tin nguồn gắn với câu trả lời.
test("TXT export preserves every message and each answer's source provenance", () => {
  const c: Conversation = {
    id: "c",
    title: "Tên hội thoại",
    created_at: "2026-10-24",
    updated_at: "2026-10-24",
    messages: [
      {
        id: "u",
        role: "user",
        content: "Câu hỏi\nDòng tiếp",
        status: "saved",
        citations: [],
        created_at: "2026-10-24",
      },
      {
        id: "a",
        role: "assistant",
        content: "Trả lời [1]",
        status: "answered",
        created_at: "2026-10-24",
        citations: [
          {
            id: "1",
            chunkId: "x",
            documentId: "web",
            revisionId: "web",
            version: 1,
            title: "Nguồn",
            page: 1,
            pageEnd: 1,
            section: "",
            quote: "Nguyên văn\nĐầy đủ",
            scope: "Năm 2026",
            url: "https://example.edu/source",
            retrievedAt: "2026-10-24T00:00:00Z",
            sourceTier: "institutional",
            assessment: "Cơ quan",
          },
        ],
      },
    ],
  };
  const text = conversationText(c);
  for (const expected of [
    c.title,
    c.messages![0].content,
    c.messages![1].content,
    "https://example.edu/source",
    "Nguyên văn\nĐầy đủ",
    "Năm 2026",
    "2026-10-24T00:00:00Z",
    "Cơ quan",
  ])
    assert.ok(text.includes(expected), expected);
  assert.equal((text.match(/NGUỒN CỦA CÂU TRẢ LỜI NÀY/g) || []).length, 1);
});

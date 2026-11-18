import { test } from "node:test";
import assert from "node:assert/strict";
import { tuitionFollowUp } from "../rag/context";

test("nhận lượt bổ sung khóa và chương trình sau câu hỏi học phí", () => {
  const result = tuitionFollowUp("K29 CMU mới nhất", [{ role: "user", content: "tìm hiểu về học phí" }]);
  assert.match(result || "", /K29/);
  assert.match(result || "", /CMU/);
});
test("không mang ngữ cảnh học phí sang câu hỏi mới", () => {
  assert.equal(tuitionFollowUp("lịch thi K29 ở đâu", [{ role: "user", content: "học phí" }]), null);
});

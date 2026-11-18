// Mục đích file: Kiểm thử: Giữ lại nguồn của nhà xuất bản cụ thể khi chọn kết quả.
import test from "node:test";
import assert from "node:assert/strict";
import { requestedPublisherBoost } from "../../BE/web-sources";
import { chooseSearchCandidates } from "../../BE/web-search";
import { introducesUncitedValues } from "../../BE/rag/dialogue";
// Khi hỏi rõ nhà xuất bản, không để nguồn không liên quan chiếm hết kết quả.
test("a named publisher cannot be crowded out by unrelated higher search scores", () => {
  const query =
    "Theo Times Higher Education, Duy Tan University thành lập năm nào?";
  const target =
    "https://www.timeshighereducation.com/world-university-rankings/duy-tan-university";
  const candidates = [
    "https://edurank.org/x",
    "https://tuoitre.vn/x",
    "https://thanhnien.vn/x",
    "https://vnexpress.net/x",
    "https://www.topuniversities.com/x",
  ].map((url, i) => ({
    url,
    title: "Duy Tan University",
    snippet: "",
    score: 100 - i,
  }));
  candidates.push({
    url: target,
    title: "Duy Tan University",
    snippet: "",
    score: 0,
  });
  assert.equal(chooseSearchCandidates(candidates, 5, query)[0].url, target);
  assert.equal(
    requestedPublisherBoost(
      "https://timeshighereducation.com.evil.example/x",
      query,
    ),
    0,
  );
});
// Giải thích khi thiếu nguồn không được tự đưa thêm ngày tháng lịch sử.
test("uncited gap explanations cannot introduce historical dates before 2000", () => {
  assert.equal(
    introducesUncitedValues(
      "Trường thành lập 11/11/1994.",
      "Theo THE, trường thành lập năm nào?",
    ),
    true,
  );
});

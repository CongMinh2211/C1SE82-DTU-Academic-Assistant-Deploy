import test from "node:test";
import assert from "node:assert/strict";
import { tuitionFollowUp, explicitTopicShift, lookupFollowUp } from "../rag/context";
import { questionCohorts, questionMajorCodes } from "../rag/retrieve";

type Turn = { role: "user" | "assistant"; content: string };
const user = (content: string): Turn => ({role:"user",content});
const ai = (content: string): Turn => ({role:"assistant",content});

test("hỏi nhiều lượt giữ khóa, chương trình và ngành người dùng cung cấp", () => {
  const history = [user("Tìm hiểu về học phí"), ai("Bạn muốn tra theo khóa nào?"), user("K29 CMU mới nhất"), ai("Bạn muốn tra ngành nào?")];
  // Bổ sung ngành vào khóa/chương trình đã nêu nhưng không tự thêm năm học.
  const resolved = tuitionFollowUp("ngành Digital Marketing", history)!;
  assert.deepEqual(questionCohorts(resolved), ["29"]);
  assert.match(resolved, /CMU/);
  assert.match(resolved, /Digital Marketing/);
  assert.doesNotMatch(resolved, /2026-2027/);
});

test("đổi ngành và năm thay thông tin cũ; không lấy số từ câu trả lời", () => {
  const history = [user("Học phí K29 ngành Digital Marketing năm 2025-2026?"), ai("1.500.000 đồng"), user("K30 CMU"), ai("Bạn muốn ngành nào?")];
  // Ưu tiên chi tiết sinh viên vừa đổi, đồng thời loại số tiền nằm trong câu trả lời AI.
  const resolved = tuitionFollowUp("ngành Công nghệ phần mềm năm 2026-2027", history)!;
  assert.deepEqual(questionCohorts(resolved), ["30"]);
  assert.match(resolved, /Công nghệ phần mềm/);
  assert.doesNotMatch(resolved, /Digital Marketing|1\.500\.000|2025-2026/);
  assert.match(resolved, /2026-2027/);
});

test("chủ đề mới không bị kéo lại thông tin học phí của lượt trước", () => {
  const history = [user("Học phí K29 mã 102 năm 2026-2027"), ai("..."), user("Lịch thi ở đâu?"), ai("...")];
  // Khi đã chuyển sang lịch thi, một lượt ngắn không được nối về học phí cũ.
  assert.equal(tuitionFollowUp("K30", history), null);
  assert.equal(tuitionFollowUp("điều kiện tốt nghiệp K29", history), null);
  assert.equal(explicitTopicShift("lịch thi ở đâu", [user("Học phí K29"), ai("..."), user("102 CMU")]), true);
});

test("thay mã ngành và hỏi năm mới nhất không tái sử dụng năm cũ", () => {
  const history = [user("Học phí K29 mã 102 năm 2025-2026"), ai("..."), user("mã 116(CMU)")];
  const resolved = tuitionFollowUp("mới nhất", history)!;
  assert.deepEqual(questionMajorCodes(resolved), ["116(cmu)"]);
  assert.doesNotMatch(resolved, /2025-2026|mã chuyên ngành 102/);
});

test("không biến câu hỏi thanh toán cụ thể thành câu hỏi bảng giá", () => {
  const history = [user("Học phí K29 ngành Marketing bao nhiêu?"), ai("...")];
  assert.equal(tuitionFollowUp("cách nộp học phí thế nào?", history), null);
});


test("yêu cầu tra lại giữ chủ đề gần nhất, chủ đề mới không bị ghép", () => {
  const history = [user("code html sao"), ai("Bạn muốn gì?"), user("mẫu đăng ký học phần"), ai("Chưa tìm thấy nguồn.")];
  assert.match(lookupFollowUp("tra cứu ra cho tôi đi", history)!, /mẫu đăng ký học phần/);
  assert.match(lookupFollowUp("cụ thể", history)!, /mẫu đăng ký học phần/);
  assert.equal(lookupFollowUp("code html", history), null);
  assert.equal(lookupFollowUp("tra cứu ra cho tôi đi", []), null);
});

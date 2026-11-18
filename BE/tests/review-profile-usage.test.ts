// Mục đích file: Kiểm thử: Quyền chỉnh hồ sơ và số liệu thống kê theo khoảng thời gian.
import test from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../../FE/lib/profile";
import {
  summarizeUsage,
  usageTopic,
  usageWindow,
  type UsageTrace,
} from "../../BE/usage";

// Hồ sơ chuẩn hóa khóa học và từ chối thay đổi trái phép danh tính hoặc vai trò.
test("profile normalizes user-supplied cohort and rejects privilege/identity changes", () => {
  const profile = {
    name: " Nguyễn Minh ",
    studentCode: "2820123456",
    cohort: "29",
    major: "Hệ thống thông tin quản lý",
  };
  assert.equal(profileSchema.parse(profile).cohort, "K29");
  assert.equal(
    profileSchema.parse({ ...profile, cohort: "k 31" }).cohort,
    "K31",
  );
  for (const change of [
    { role: "admin" },
    { email: "new@example.test" },
    { id: "another-user" },
  ])
    assert.equal(
      profileSchema.safeParse({ ...profile, ...change }).success,
      false,
    );
  for (const change of [
    { major: "x".repeat(161) },
    { cohort: "K29;drop table user" },
    { studentCode: "12\n34" },
    { name: "a" },
  ])
    assert.equal(
      profileSchema.safeParse({ ...profile, ...change }).success,
      false,
    );
  assert.equal(
    profileSchema.parse({ ...profile, studentCode: "", cohort: "", major: "" })
      .cohort,
    "",
  );
});
const makeTrace = (
  id: string,
  question: string,
  created_at: string,
  status = "answered",
  conversation_id = id,
  reason = "",
): UsageTrace => ({
  id,
  question,
  created_at,
  status,
  conversation_id,
  reason,
});
// Thống kê theo ngày Việt Nam phải bao gồm ngày trống và loại ngày ngoài phạm vi.
test("usage buckets follow Vietnam midnight, include missing days and exclude adjacent dates", () => {
  const date = new Date("2026-10-26T17:15:00.000Z"),
    window = usageWindow(7, date);
  assert.equal(window.from, "2026-10-21");
  assert.equal(window.to, "2026-10-27");
  assert.equal(window.start, "2026-10-20T17:00:00.000Z");
  const report = summarizeUsage(
    [
      makeTrace("a", "học phí K29", "2026-10-20T16:59:59.999Z"),
      makeTrace("b", "học phí K29", window.start),
      makeTrace("c", "Xin chào", "2026-10-26T17:00:00.000Z", "conversation"),
      makeTrace("d", "học phí K29", window.end),
    ],
    7,
    "",
    date,
  );
  assert.equal(report.total, 2);
  assert.equal(report.daily.length, 7);
  assert.equal(report.daily[0].count, 1);
  assert.equal(report.daily[6].count, 1);
  assert.equal(report.daily[3].count, 0);
});
// Mỗi lượt hỏi được tính một lần dù ở trạng thái hỗ trợ, hội thoại hay lỗi.
test("all questions, including support, conversation, errors and processing, count once", () => {
  const date = new Date("2026-10-27T05:00:00Z"),
    traces = [
      makeTrace(
        "1",
        "xin chào",
        "2026-10-27T01:00:00Z",
        "conversation",
        "1",
        "greeting",
      ),
      makeTrace(
        "2",
        "học phí bao nhiêu",
        "2026-10-27T01:01:00Z",
        "insufficient",
      ),
      makeTrace(
        "3",
        "lập lịch ôn thi",
        "2026-10-27T01:02:00Z",
        "conversation",
        "3",
        "study_support",
      ),
      makeTrace("4", "xếp loại học lực", "2026-10-27T01:03:00Z", "error"),
      makeTrace("5", "thông tin DTU", "2026-10-27T01:04:00Z", "processing"),
    ];
  const report = summarizeUsage(traces, 7, "", date);
  assert.equal(report.total, 5);
  assert.equal(report.outcomes.reduce((n, item) => n + item.count, 0), 5);
  assert.equal(report.outcomes.find((item) => item.status === "insufficient")?.count, 1);
  assert.equal(
    report.daily.reduce((n, d) => n + d.count, 0),
    5,
  );
  assert.equal(
    report.topics.reduce((n, t) => n + t.count, 0),
    5,
  );
  assert.equal(report.topics.find((t) => t.label === "Trò chuyện")?.count, 1);
  assert.equal(
    report.topics.find((t) => t.label === "Hỗ trợ học tập")?.count,
    1,
  );
});
// Câu hỏi tiếp có thể kế thừa chủ đề; lời cảm ơn không làm tăng thống kê học phí.
test("follow-up inherits topic while a thank-you does not inflate tuition interest", () => {
  const traces = [
    makeTrace(
      "1",
      "Học phí K31 mã 102",
      "2026-10-27T01:00:00Z",
      "answered",
      "same",
    ),
    makeTrace(
      "2",
      "Còn K27 thì sao?",
      "2026-10-27T01:01:00Z",
      "answered",
      "same",
    ),
    makeTrace("3", "Cảm ơn!", "2026-10-27T01:02:00Z", "conversation", "same"),
  ];
  const report = summarizeUsage(
    traces,
    7,
    "Học phí",
    new Date("2026-10-27T05:00:00Z"),
  );
  assert.equal(report.total, 2);
  assert.equal(
    report.topics.find((t) => t.label === "Học phí")?.percentage,
    100,
  );
  assert.equal(
    usageTopic({
      question: "Địa điểm thư viện DTU ở đâu?",
      reason: "",
      status: "answered",
    }),
    "Thông tin DTU / khác",
  );
});
// Khi chưa có dữ liệu, biểu đồ hiển thị trạng thái trống thay vì số giả.
test("empty usage is a real empty chart rather than fabricated demonstration numbers", () => {
  const report = summarizeUsage([], 30, "", new Date("2026-10-27T05:00:00Z"));
  assert.equal(report.total, 0);
  assert.equal(report.daily.length, 30);
  assert.ok(report.daily.every((day) => day.count === 0));
  assert.ok(report.topics.every((topic) => topic.percentage === 0));
});

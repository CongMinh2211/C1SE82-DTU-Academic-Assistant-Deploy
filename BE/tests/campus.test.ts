import { test } from "node:test";
import assert from "node:assert/strict";
import { campusAnswer } from "../rag/campus";

test("cơ sở 254 NVL và 209 Phan Thanh được liên kết và dẫn đúng điểm đến", () => {
  for (const q of ["254 NVL đi sao", "209 Phan Thanh", "cơ sở trường 209 phan thanh"]) {
    const answer = campusAnswer(q);
    assert.equal(answer?.status, "answered", q);
    assert.match(answer!.content, /cùng cụm cơ sở 254 Nguyễn Văn Linh - 209 Phan Thanh/);
    assert.match(answer!.citations[0].url!, /co-so-1-254-nguyen-van-linh/);
    assert.match(decodeURIComponent(answer!.content), q.includes("209") ? /209 Phan Thanh/ : /254 Nguyễn Văn Linh/);
  }
});

test("câu hỏi tiếp ngắn giữ đúng địa chỉ, đổi chủ đề không giữ nhầm", () => {
  const history = [{role:"user" as const, content:"254 NVL đi sao"}, {role:"assistant" as const, content:"Có thể xem bản đồ."}, {role:"user" as const, content:"Nguyễn Văn Linh"}];
  assert.match(campusAnswer("đường đi", history)!.content, /254 Nguyễn Văn Linh/);
  assert.match(campusAnswer("Nguyễn Văn Linh", history.slice(0, 2))!.content, /254 Nguyễn Văn Linh/);
  assert.equal(campusAnswer("đường đi", [...history, {role:"user" as const, content:"Học phí bao nhiêu?"}]), null);
  assert.match(campusAnswer("209 Phan Thanh", history)!.content, /209 Phan Thanh, Đà Nẵng/);
});

test("chỉ đường 120 Hoàng Minh Thảo trả địa chỉ và link bản đồ, không fallback", () => {
  const answer = campusAnswer("chỉ đường đến 120 hoàng minh thảo");
  assert.equal(answer?.status, "answered");
  assert.match(answer!.content, /google\.com\/maps\/dir/);
  assert.match(answer!.content, /120 Hoàng Minh Thảo/);
  assert.equal(answer!.citations.length, 2);
});
test("không nhầm số riêng và không chặn câu hỏi học vụ thông thường", () => {
  assert.match(campusAnswer("địa chỉ 137 Nguyễn Văn Linh")!.content, /Chưa xác minh được số riêng/);
  assert.equal(campusAnswer("lịch học ở cơ sở 120 Hoàng Minh Thảo"), null);
  assert.equal(campusAnswer("chỉ đường 78A Phan Văn Trị")?.status, "clarification");
});
test("nhận viết tắt có số nhà và từ không dấu", () => {
  for (const q of ["địa chỉ 254 NVL", "dia chi 254 nvl", "chỉ đường 254 N.V.L", "địa chỉ 254 nguyen van linh"]) {
    const answer = campusAnswer(q);
    assert.equal(answer?.status, "answered", q);
    assert.match(answer!.content, /254 Nguyễn Văn Linh/);
    assert.match(decodeURIComponent(answer!.content), /254 Nguyễn Văn Linh, Đà Nẵng/);
    assert.match(answer!.citations[0].url!, /co-so-1-254-nguyen-van-linh/);
  }
  assert.match(campusAnswer("địa chỉ 137 NVL")!.content, /137 Nguyễn Văn Linh/);
  assert.match(campusAnswer("địa chỉ 120 HMT")!.content, /120 Hoàng Minh Thảo/);
});
test("viết tắt không rõ số nhà cần hỏi lại và không nhận nhầm số khác", () => {
  const answer = campusAnswer("cơ sở NVL ở đâu");
  assert.equal(answer?.status, "clarification");
  assert.match(answer!.content, /254 hay 137/);
  assert.equal(campusAnswer("địa chỉ 2254 NVL"), null);
  assert.equal(campusAnswer("lịch học cơ sở 254 NVL"), null);
});

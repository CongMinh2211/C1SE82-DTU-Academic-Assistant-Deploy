import test from "node:test";
import assert from "node:assert/strict";
import { accountNameReply, conversationRecall } from "../rag/dialogue";
import { portalAnswer } from "../rag/portal";

test("nhắc đúng câu trước trong hội thoại và xử lý khi không có lịch sử", () => {
  const history = [{role:"user" as const,content:"Học phí K29 bao nhiêu?"},{role:"assistant" as const,content:"Bạn học ngành nào?"}];
  assert.match(conversationRecall("tôi vừa hỏi gì", history)!, /Học phí K29 bao nhiêu\?/);
  assert.match(conversationRecall("tôi vừa hỏi gì", [])!, /chưa hỏi/);
  assert.equal(conversationRecall("tôi vừa hỏi học phí gì", history), null);
});

test("tên chỉ là tên hiển thị tài khoản và không tự đoán danh tính", () => {
  assert.equal(accountNameReply("tôi tên gì", "Minh"), "Tên hiển thị trong tài khoản của bạn là Minh.");
  assert.match(accountNameReply("tôi tên gì", undefined)!, /chưa có/);
  assert.equal(accountNameReply("tên giảng viên là gì", "Minh"), null);
});

test("câu hỏi về website hiện tại chỉ đến trường và nguồn chính thức", () => {
  const result = portalAnswer("đây là web site của trường nào");
  assert.equal(result?.status, "answered");
  assert.match(result!.content, /Đại học Duy Tân/);
  assert.equal(result!.citations[0].url, "https://duytan.edu.vn/");
  assert.equal(portalAnswer("website của trường Bách Khoa là gì"), null);
});

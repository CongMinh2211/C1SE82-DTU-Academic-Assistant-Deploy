import test from "node:test";
import assert from "node:assert/strict";
import { isEnglish } from "../rag/dialogue";
import { expand } from "../rag/retrieve";
import { portalAnswer } from "../rag/portal";
import { guidePage } from "../rag/mydtu-guide";
import { examDirectoryAnswer } from "../rag/exam-directory";

// Kiểm tra câu hỏi tiếng Anh có tên riêng tiếng Việt và câu tiếng Việt không dấu.
test("nhận diện ngôn ngữ câu hỏi học vụ", () => {
  for (const question of ["Where is Trần Kim Sanh?", "Exam schedule?", "How do I pay tuition?"]) assert.equal(isEnglish(question), true, question);
  for (const question of ["hoc phi bao nhieu", "email thầy Trần Kim Sanh"]) assert.equal(isEnglish(question), false, question);
});

// Câu tiếng Anh và tài liệu tiếng Việt phải gặp nhau qua từ đồng nghĩa, không tự tạo bằng chứng.
test("mở rộng truy vấn tiếng Anh theo nhiều chủ đề", () => {
  for (const [question, expected] of [
    ["Where is the exam schedule?", "lich thi"],
    ["How much does a credit cost for tuition?", "tin chi"],
    ["How can I apply for a scholarship?", "hoc bong"],
    ["How do I contact my academic advisor?", "co van hoc tap"],
    ["What are the computer lab rules?", "phong may"],
    ["How do I evaluate my lecturer?", "giang vien"],
  ]) assert.ok(expand(question).includes(expected), question);
});

// Kiểm tra các đường dẫn và trang có sẵn thay vì yêu cầu mô hình suy đoán.
test("câu tiếng Anh mở đúng cổng và trang hướng dẫn", () => {
  assert.match(examDirectoryAnswer("Where can I view the exam schedule?")!.content, /https:\/\/pdaotao/);
  for (const question of ["Where can I view my class schedule?", "Where can I check my grades?", "How can I register for courses?", "How do I pay my tuition?"]) {
    const answer = portalAnswer(question);
    assert.equal(answer?.status, "answered", question);
    assert.match(answer!.content, /MyDTU/);
    assert.equal(answer!.citations[0].url, "https://mydtu.duytan.edu.vn/");
  }
  assert.equal(portalAnswer("How much is tuition per credit?"), null);
  assert.equal(portalAnswer("What is the bank transfer reference for tuition?"), null);
  assert.equal(guidePage("How do I register off-campus residence?")?.page, 41);
  assert.equal(guidePage("How do I evaluate my lecturer?")?.page, 42);
  assert.equal(guidePage("How do I check my conduct assessment?")?.page, 40);
  assert.equal(guidePage("How do I register for courses on myDTU?")?.page, 24);
});

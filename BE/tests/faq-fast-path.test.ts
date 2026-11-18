// Mục đích file: Kiểm thử: FAQ trùng câu hỏi chỉ được trả trực tiếp khi có nguồn hợp lệ.
import test from "node:test";
import assert from "node:assert/strict";
import { approvedFaqAnswer } from "../../BE/rag/faq-answer";

const faq = {
  question: "Đăng ký học phần ở đâu?",
  answer: "Xem trên cổng đào tạo.",
  chunk_id: "c1",
  document_id: "d1",
  revision_id: "r1",
  title: "Hướng dẫn",
  version: 1,
  page: 2,
  page_end: 2,
  section: "Đăng ký",
  text: "Xem trên cổng đào tạo.",
  scope: "Sinh viên",
  source_url: "https://pdaotao.duytan.edu.vn/",
};

// FAQ trùng sau chuẩn hóa phải trả câu đã duyệt và thông tin phiên bản nguồn.
test("FAQ đã duyệt trả lời ngay với nguồn khi câu hỏi trùng sau chuẩn hóa", () => {
  const result = approvedFaqAnswer("dang ky hoc phan o dau!", [faq]);
  assert.equal(result?.reason, "approved_faq");
  assert.equal(result?.citations[0].revisionId, "r1");
  assert.match(result!.content, /\[1\]/);
});
// Các FAQ không khớp, trùng hoặc thiếu đoạn nguồn không được đi tắt.
test("không trả lời FAQ khi khác câu hỏi, trùng mâu thuẫn hoặc thiếu nội dung nguồn", () => {
  assert.equal(approvedFaqAnswer("đăng ký học phần khi nào?", [faq]), null);
  assert.equal(
    approvedFaqAnswer(faq.question, [faq, { ...faq, answer: "Khác" }]),
    null,
  );
  assert.equal(approvedFaqAnswer(faq.question, [{ ...faq, text: "" }]), null);
});

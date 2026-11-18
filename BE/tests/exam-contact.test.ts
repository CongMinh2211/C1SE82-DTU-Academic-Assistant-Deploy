// Mục đích file: Kiểm thử: Đường dẫn lịch thi, chuyển chủ đề và phân biệt hỏi email với soạn thư.
import test from "node:test";
import assert from "node:assert/strict";
import { examDirectoryAnswer } from "../../BE/rag/exam-directory";
import { asksForContact } from "../../BE/rag/dialogue";
import { explicitTopicShift } from "../../BE/rag/context";

// Câu hỏi tìm nơi xem lịch thi nhận đường dẫn chính thức; câu hỏi thời gian cá nhân không được đoán.
test("chỉ dẫn trang danh sách thi và không tự trả ngày thi cá nhân", () => {
  assert.equal(
    examDirectoryAnswer("Xem lịch thi ở đâu?")?.citations[0].url,
    "https://pdaotao.duytan.edu.vn/EXAM_LIST/Default.aspx?lang=VN",
  );
  assert.equal(
    examDirectoryAnswer("Xem lịch thi môn toán của tôi khi nào?"),
    null,
  );
  for (const question of ["Where can I view the exam schedule?", "Where can I find my examination timetable?", "How can I check the exam list?"]) {
    const answer = examDirectoryAnswer(question);
    assert.equal(answer?.status, "answered", question);
    assert.match(answer!.content, /You can check/);
    assert.equal(answer!.citations[0].url, "https://pdaotao.duytan.edu.vn/EXAM_LIST/Default.aspx?lang=VN");
  }
  assert.equal(examDirectoryAnswer("When is my exam?"), null);
  assert.equal(examDirectoryAnswer("Where and when is the exam schedule?"), null);
  assert.equal(examDirectoryAnswer("Where can I view my class schedule?"), null);
});
// Khi đổi chủ đề không giữ khóa học phí cũ; câu hỏi nối tiếp vẫn giữ ngữ cảnh.
test("chủ đề mới tách khỏi học phí, lời hỏi tiếp giữ ngữ cảnh", () => {
  const history = [
    { role: "user" as const, content: "Học phí K30 bao nhiêu?" },
  ];
  assert.equal(explicitTopicShift("Nội quy phòng máy là gì?", history), true);
  assert.equal(explicitTopicShift("Giải thích rõ hơn", history), false);
  assert.equal(explicitTopicShift("Học phí K31 bao nhiêu?", history), false);
});
// Phân biệt yêu cầu tìm địa chỉ email với yêu cầu soạn nội dung thư.
test("hỏi email giảng viên là tra cứu, yêu cầu soạn mail vẫn là viết thư", () => {
  assert.equal(asksForContact("Email thầy Nguyễn Đức Mận"), true);
  assert.equal(asksForContact("Viết email hỏi thầy Mận"), false);
});

import { isPreferredSource } from "./source-preference";
import { currentlyUsable } from "./source-validity";
// Mục đích file: Ánh xạ một số câu hỏi myDTU tới trang PDF đã đối chiếu và tạo trích dẫn tương ứng.
import { row } from "../db";
import { normalize } from "./parser";
import { isEnglish } from "./dialogue";
import type { Answer } from "./answer";

// Các trang được đối chiếu với PDF gốc, không gán trang nếu nguồn chưa xuất bản.
export function guidePage(question: string) {
  // Chuẩn hóa chữ có dấu để nhận diện các cách gõ tương tự của sinh viên.
  const q = normalize(question);
  // Ánh xạ câu hỏi tiếng Anh về đúng trang đã kiểm chứng, giữ tên menu như trên myDTU.
  if (isEnglish(question)) {
    if (/\b(?:off-campus|off campus|residence|accommodation)\b/.test(q) && /\b(?:declare|declaration|register|registration|report|how|where)\b/.test(q))
      return { page: 41, label: "off-campus residence declaration", tip: "1. Sign in to myDTU.\n2. Open Cố vấn học tập → Khai báo Ngoại trú.\n3. Select the academic year and semester, then choose Khai Báo Ngoại Trú. [1]\n\nThe guide does not show the remaining form steps; check the screen or ask your academic advisor." };
    if (/\b(?:lecturer|teacher|professor|faculty)\b/.test(q) && /\b(?:evaluate|evaluation|survey|feedback|assessment)\b/.test(q))
      return { page: 42, label: "lecturer evaluation", tip: "1. Sign in to myDTU.\n2. Open Đánh giá → Đánh giá Giảng viên.\n3. Select the academic year and semester to see the lecturers and evaluation status. [1]\n\nThe guide does not show every submission step; follow the instructions on screen." };
    if (/\b(?:conduct|training)\b/.test(q) && /\b(?:evaluate|evaluation|assessment|score|points)\b/.test(q))
      return { page: 40, label: "conduct assessment", tip: "1. Sign in to myDTU.\n2. Open Cố vấn học tập → Đánh giá Rèn luyện.\n3. Review the assessment. [1]\n\nThe guide does not show all submission steps; contact your academic advisor if the assessment is closed." };
    if (/\b(?:mydtu|my dtu)\b/.test(q)) {
      if (/\b(?:register|enrol|enroll|registration)\b/.test(q) && /\b(?:course|courses|class|classes|subject|subjects)\b/.test(q)) return { page: 24, endPage: 27, label: "course registration", tip: "1. Sign in to myDTU.\n2. Open Học tập → Đăng ký môn học. [1]\n3. Select the academic year and semester, choose an available class, enter the verification code and register as shown on the following pages. [2]" };
      if (/\b(?:class schedule|class timetable)\b/.test(q)) return { page: 16, label: "class schedule", tip: "Sign in to myDTU and open Lịch học to view the daily, weekly or monthly schedule." };
      if (/\b(?:grades|transcript|grade report)\b/.test(q)) return { page: 31, label: "grades", tip: "Open Học tập → Bảng điểm to view grades by semester." };
      if (/\b(?:tuition|fees|payment history|invoice)\b/.test(q)) return { page: 45, label: "tuition", tip: "Open Học phí, then choose Hóa đơn học phí or Lịch sử thanh toán." };
      if (/\b(?:personal information|profile)\b/.test(q)) return { page: 9, label: "personal information", tip: "Open Thông tin cá nhân to view or update the information available to you." };
    }
  }
  // Ba thao tác này thường được gọi tên trực tiếp, không nhất thiết kèm tên myDTU.
  const how =
    /\b(?:cach|huong dan|the nao|lam sao|o dau|nhu the nao|lam gi|sao|truy cap)\b/.test(
      q,
    ) ||
    /^(?:khai bao ngoai tru|dang ky ngoai tru|danh gia giang vien|khao sat giang vien|danh gia ren luyen|cham ren luyen)[?.! ]*$/.test(
      q.trim(),
    );
  if (how && /\b(?:khai bao ngoai tru|dang ky ngoai tru)\b/.test(q))
    return {
      page: 41,
      label: "khai báo ngoại trú",
      tip: "1. Đăng nhập myDTU.\n2. Mở Cố vấn học tập → Khai báo Ngoại trú.\n3. Trong hình hướng dẫn, chọn năm học và học kỳ, sau đó chọn Khai Báo Ngoại Trú. [1]\n\nẢnh không thể hiện các bước sau khi mở biểu mẫu; hãy kiểm tra hướng dẫn trên màn hình hoặc hỏi cố vấn học tập.",
    };
  if (how && /\b(?:danh gia giang vien|khao sat giang vien)\b/.test(q))
    return {
      page: 42,
      label: "đánh giá giảng viên",
      tip: "1. Đăng nhập myDTU.\n2. Mở Đánh giá → Đánh giá Giảng viên.\n3. Chọn năm học và học kỳ để xem danh sách giảng viên và trạng thái đánh giá. [1]\n\nTài liệu không thể hiện rõ toàn bộ bước gửi phiếu; hãy xem hướng dẫn trên hệ thống.",
    };
  if (how && /\b(?:danh gia ren luyen|diem ren luyen|cham ren luyen)\b/.test(q))
    return {
      page: 40,
      label: "đánh giá rèn luyện",
      tip: "1. Đăng nhập myDTU.\n2. Mở Cố vấn học tập → Đánh giá Rèn luyện.\n3. Xem bảng đánh giá. Hình minh họa có thể hiển thị ‘Chưa được phép/Đã hết hạn Đánh giá’. [1]\n\nTài liệu không nêu đầy đủ cách điền và gửi; nếu mục chưa mở hoặc đã hết hạn, hỏi cố vấn học tập.",
    };
  // Các mục còn lại yêu cầu nhắc đến myDTU để giảm nhầm lẫn với quy trình khác.
  if (!/\b(?:mydtu|my dtu)\b/.test(q)) return null;
  if (/\b(?:dang ky mon|dang ky hoc phan)\b/.test(q))
    return {
      page: 24,
      label: "đăng ký môn học",
      tip: "1. Đăng nhập myDTU.\n2. Vào Học tập → Đăng ký môn học. [1]\n3. Chọn năm học và học kỳ, tìm lớp đang mở và bấm Chọn. Nhập mã xác nhận rồi bấm Đăng ký theo hướng dẫn ở các trang tiếp theo. [2]",
      endPage: 27,
    };
  if (/\b(?:lich hoc|thoi khoa bieu)\b/.test(q))
    return {
      page: 16,
      label: "xem lịch học",
      tip: "1. Đăng nhập myDTU.\n2. Vào mục Lịch học để xem theo ngày, tuần hoặc tháng.",
    };
  if (/\b(?:bang diem|xem diem)\b/.test(q))
    return {
      page: 31,
      label: "xem bảng điểm",
      tip: "Trong mục Học tập, chọn Bảng điểm để xem điểm theo học kỳ.",
    };
  if (/\b(?:hoc phi|lich su thanh toan|hoa don)\b/.test(q))
    return {
      page: 45,
      label: "xem học phí",
      tip: "Vào mục Học phí và chọn Hóa đơn học phí hoặc Lịch sử thanh toán theo nhu cầu.",
    };
  if (/\b(?:thong tin ca nhan|ho so ca nhan)\b/.test(q))
    return {
      page: 9,
      label: "thông tin cá nhân",
      tip: "Vào mục Thông tin cá nhân để xem hoặc cập nhật các thông tin được phép.",
    };
  return null;
}

export async function mydtuGuideAnswer(
  question: string,
): Promise<Answer | null> {
  // Nếu câu hỏi không thuộc các mục đã đối chiếu, để đường truy xuất tổng quát xử lý.
  const target = guidePage(question);
  if (!target) return null;
  // Tìm đoạn thuộc đúng trang và phiên bản PDF đang công bố, không dùng bản nháp.
  const source = await row<{
    id: string;
    document_id: string;
    revision_id: string;
    page: number;
    page_end: number;
    section: string;
    text: string;
    title: string;
    scope: string;
    version: number;
    issued_on?:string|null; effective_from?:string|null; effective_until?:string|null; scope_key?:string|null;
  }>(
    `SELECT c.id,c.document_id,c.revision_id,c.page,c.page_end,c.section,c.text,r.title_snapshot title,r.scope_snapshot scope,r.version,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM chunks c JOIN revisions r ON r.id=c.revision_id JOIN documents d ON d.id=c.document_id AND d.active_revision=c.revision_id WHERE d.deleted_at IS NULL AND r.status='published' AND r.title_snapshot=? AND c.page=? ORDER BY length(c.text) DESC LIMIT 1`,
    "Hướng dẫn sử dụng myDTU cho sinh viên - 2021",
    target.page,
  );
  if (!source || !currentlyUsable(source) || !(await isPreferredSource(source, question))) return null;
  // Tạo trích dẫn để giao diện mở đúng trang tài liệu gốc.
  const refs = [
    {
      id: "1",
      chunkId: source.id,
      documentId: source.document_id,
      revisionId: source.revision_id,
      title: source.title,
      version: source.version,
      page: source.page,
      pageEnd: source.page_end,
      section: source.section,
      quote: source.text,
      scope: source.scope,
    },
  ];
  if ("endPage" in target && target.endPage) {
    // Một số quy trình trải qua nhiều trang; thêm trích dẫn cho phần tiếp theo.
    const next = await row<typeof source>(
      `SELECT c.id,c.document_id,c.revision_id,c.page,c.page_end,c.section,c.text,r.title_snapshot title,r.scope_snapshot scope,r.version,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM chunks c JOIN revisions r ON r.id=c.revision_id JOIN documents d ON d.id=c.document_id AND d.active_revision=c.revision_id WHERE d.deleted_at IS NULL AND r.status='published' AND r.id=? AND c.page=? ORDER BY length(c.text) DESC LIMIT 1`,
      source.revision_id,
      25,
    );
    if (!next) return null;
    refs.push({
      id: "2",
      chunkId: next.id,
      documentId: next.document_id,
      revisionId: next.revision_id,
      title: next.title,
      version: next.version,
      page: next.page,
      pageEnd: target.endPage,
      section: next.section,
      quote: next.text,
      scope: next.scope,
    });
  }
  const tip = /\[1\]/.test(target.tip) ? target.tip : `${target.tip} [1]`;
  return {
    status: "answered",
    reason: "mydtu_guide_page",
    webStatus: "not_needed",
    retrieval: [],
    content: isEnglish(question) ? `According to the 2021 myDTU guide:\n${tip}\n\nThe ${target.label} section starts on page ${source.page}. The current interface may have changed.` : `Theo tài liệu myDTU năm 2021:\n${tip}\n\nMục ${target.label} được minh họa từ trang ${source.page}. Giao diện hiện nay có thể đã thay đổi.`,
    citations: refs,
  };
}

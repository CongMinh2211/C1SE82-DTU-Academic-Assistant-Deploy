export const academicTopics = [
  {
    id: "registration",
    label: "Đăng ký học phần",
    icon: "file",
    questions: [
      "Khi nào sinh viên được đăng ký, hủy đăng ký hoặc bỏ đăng ký học phần (nhận điểm W/R) cho Học kỳ I năm học 2026-2027?",
      "Đối với sinh viên đang nợ môn (học lại) hoặc muốn học vượt, thời gian đăng ký được quy định thế nào?",
      "Quy định về số tín chỉ đăng ký tối thiểu và tối đa trong một học kỳ theo Quy chế đào tạo chung là gì?",
    ],
  },
  {
    id: "tuition",
    label: "Học phí",
    icon: "file",
    questions: ["Mức học phí của K29 ngành Hệ thống thông tin quản lý?"],
  },
  {
    id: "grades",
    label: "Điểm số",
    icon: "book",
    questions: [
      "Cách tính điểm học phần và quy đổi điểm chữ như thế nào?",
      "Sinh viên được xếp loại học lực Xuất sắc, Giỏi, Khá... dựa trên thang điểm nào?",
    ],
  },
  {
    id: "graduation",
    label: "Tốt nghiệp",
    icon: "book",
    questions: [
      "Sinh viên cần thỏa mãn những điều kiện gì để được xét công nhận tốt nghiệp?",
      "Sinh viên muốn làm Khóa luận tốt nghiệp (KLTN) hoặc Đồ án tốt nghiệp (ĐATN) thì cần điều kiện gì?",
      "Sinh viên chưa có chứng chỉ GDQP-AN hoặc chưa đạt chuẩn Tin học/Ngoại ngữ có được bảo vệ KLTN không?",
    ],
  },
] as const;

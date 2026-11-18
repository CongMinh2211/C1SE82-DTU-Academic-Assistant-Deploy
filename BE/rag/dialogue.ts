// Mục đích file: Nhận diện cách hỏi và các trường hợp hội thoại; hạn chế trộn yêu cầu soạn thảo với tra cứu.
import { normalize } from "./parser";

export type Turn = { role: "user" | "assistant"; content: string };

// Hỏi địa chỉ email là tra cứu; chỉ soạn thư khi người dùng yêu cầu viết thư.
export function asksForContact(question: string) {
  const q = normalize(question);
  return (
    /\b(?:email|e-mail|mail|dia chi email)\b/.test(q) &&
    !/\b(?:soan|viet|gui|draft|write|compose)\b/.test(q)
  );
}

export function obviousStudyTask(question: string, history: Turn[]) {
  const q = normalize(question);
  if (
    /\b(?:soan|viet|draft|write)\b[\s\S]*\b(?:email|mail)\b/.test(q) &&
    !/\b(?:trich nguon|citation|sources?|theo quy dinh|according to|policy|quy dinh)\b/.test(
      q,
    )
  )
    return true;
  const task = q.replace(
    /khong (?:can )?quy doi(?: he 4)?|khong phai (?:gpa )?chinh thuc|not (?:an? )?official (?:gpa)?|without (?:conversion|converting)/g,
    "",
  );
  if (
    /\b(?:hoc phi|tuition|quy dinh|chinh sach|chinh thuc|quy doi|official|policy|rules?|deadline|han nop|dieu kien|grade conversion|dang ky|registration|tot nghiep|graduation|khi nao|when|ngay thi|exam date)\b/.test(
      task,
    )
  )
    return false;
  if (
    /\b(?:on thi|on tap|revision|revise|study plan|luyen tap)\b/.test(task) &&
    /\b(?:lap|len|giup|cho|give|make|create|plan|help)\b/.test(task)
  )
    return true;
  if (
    /\d/.test(task) &&
    /\b(?:trung binh|weighted average|average)\b/.test(task) &&
    /\b(?:tinh|calculate|compute|them)\b/.test(task)
  )
    return true;
  if (
    /them mon|add.*course/i.test(task) &&
    /\d/.test(task) &&
    history.some(
      (t) =>
        t.role === "user" &&
        /trung binh|weighted average/.test(normalize(t.content)),
    )
  )
    return true;
  if (
    /rut|dieu chinh|adapt|change|shorten|extend/.test(task) &&
    /\b(?:ngay|phut|days?|minutes?|hours?)\b/.test(task) &&
    history.some(
      (t) =>
        t.role === "user" &&
        /on thi|on tap|revision|study/.test(normalize(t.content)),
    )
  )
    return true;
  return (
    /sap thi|stressed|overwhelmed/.test(task) &&
    /bat dau tu dau|begin|start|phut|minutes?/.test(task)
  );
}

export function introducesUncitedValues(reply: string, question: string) {
  const values = (text: string) =>
    [
      ...normalize(text).matchAll(
        /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}\b|\b\d[\d.,]*\s*(?:dong|vnd|usd)\b/g,
      ),
    ].map((match) => match[0].replace(/[.,\s]/g, ""));
  const supplied = new Set(values(question));
  return values(reply).some((value) => !supplied.has(value));
}

export function isEnglish(question: string) {
  const text = question.trim();
  // Nhận diện câu tiếng Anh có chứa tên riêng tiếng Việt mà không bỏ dấu tên.
  if (/\b(?:where|what|when|how|which|could|would|should|can i|please|tell me)\b/i.test(text)) return true;
  if (
    /\b(?:ban|minh|em|toi|hoc|giup|cam on|xin chao|tin chi|duoc|khoa|nam hoc|cho biet|diem)\b/.test(
      normalize(text),
    )
  )
    return false;
  return (
    !/[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/i.test(text) &&
    /\b(what|how|can|when|where|is|are|tuition|graduation|please|my|help|do|thanks|hello|hi|give|explain|have|study|revise|exam|timetable|schedule|grades|scholarship|lecturer|professor|fees|payment|courses|campus)\b/i.test(
      text,
    )
  );
}

// These are the application's own features, not institutional facts. Keeping
// them in one place prevents the model from promising integrations we lack.
export function capabilitiesReply(english: boolean, repairing = false) {
  if (english)
    return `${repairing ? "You're right — here's a concrete answer.\n\n" : ""}I can help you with:
• Academic information: find and explain tuition tables, course registration notices and graduation requirements, with sources and their applicable period.
• DTU information: search the public web, compare relevant sources and cite what I find. You don't need to send a link.
• Study support: break down a task, make a study plan, explain text you provide, or draft an email to ask for help.
• Follow-up questions: keep the context, explain an answer more simply, and distinguish what is confirmed from what still needs checking.

For example: “What is the tuition for K31, programme code 102, in 2026–2027?” or “Help me plan seven days of revision.”

I can't access your private myDTU grades or submit university procedures for you. Which task would you like to start with?`;
  return `${repairing ? "Bạn nói đúng, mình trả lời cụ thể nhé.\n\n" : ""}Mình có thể giúp bạn:
• Tra cứu học vụ: tìm và giải thích học phí, đăng ký học phần, điều kiện tốt nghiệp; kèm nguồn và thời điểm áp dụng.
• Tìm thông tin về DTU: tự tìm trên toàn web, đối chiếu nguồn liên quan và trích dẫn. Bạn không cần gửi link.
• Hỗ trợ việc học: chia nhỏ bài tập, lập kế hoạch ôn thi, giải thích nội dung bạn cung cấp hoặc soạn email nhờ hỗ trợ.
• Hỏi tiếp theo ngữ cảnh: giải thích dễ hiểu hơn, làm rõ điều kiện và phân biệt thông tin đã xác nhận với phần còn thiếu.

Bạn có thể thử: “Học phí K31 mã 102 năm 2026–2027 bao nhiêu?” hoặc “Giúp mình lên lịch ôn thi trong 7 ngày.”

Mình chưa truy cập được điểm/hồ sơ riêng trên myDTU hay thực hiện thủ tục thay bạn. Bạn muốn bắt đầu với việc nào?`;
}

export function asksCapabilities(question: string) {
  const text = normalize(question)
    .replace(/[!?.,;:…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Only a complete meta question can take this fast path. A greeting followed
  // by a tuition/deadline question must still go through grounded lookup.
  return (
    /^(?:(?:xin chao|chao ban|hi|hello) )?(?:(?:ban|bot|tro ly|minh|em|toi) )?(?:co the )?(?:(?:lam|giup|ho tro)(?: (?:minh|em|toi|ban))? (?:duoc )?(?:nhung )?(?:gi|viec gi|dieu gi)|giup ich gi)(?: (?:vay|nhi|nhe|a|ha|o day|cho sinh vien|dang hoi ma))*$/.test(
      text,
    ) ||
    /^(?:what (?:can|could) you (?:do|help (?:me )?with)|how can you help(?: me)?|what are your (?:capabilities|features))(?: please)?$/.test(
      text,
    )
  );
}

export function isRepair(question: string, history: Turn[]) {
  return (
    history.length > 0 &&
    /chua tra loi|dang hoi ma|hoi lai|tra loi cu the|vong vo|lap lai|you didn.t answer|be specific/i.test(
      normalize(question),
    )
  );
}

export function dialogueFallback(question: string, english: boolean) {
  if (/\b(gpa|mydtu|diem ca nhan|ho so ca nhan)\b/.test(normalize(question)))
    return english
      ? "I can't access your private myDTU record. If you share the grades and credits you want to use (without a password or student ID), I can help calculate a credit-weighted average."
      : "Mình chưa truy cập được hồ sơ riêng trên myDTU. Bạn có thể gửi điểm và số tín chỉ cần tính (không gửi mật khẩu hay mã sinh viên), mình sẽ giúp tính trung bình có trọng số và giải thích cách tính.";
  return english
    ? "I'm having trouble preparing a useful reply right now. Please try sending the question again; I can help with academic information, DTU web research or a concrete study task."
    : "Mình đang gặp lỗi khi chuẩn bị câu trả lời. Bạn thử gửi lại nhé; mình có thể tra cứu học vụ, tìm thông tin DTU trên web hoặc hỗ trợ một việc học cụ thể.";
}

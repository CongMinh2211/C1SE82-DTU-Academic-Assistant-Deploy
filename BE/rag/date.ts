// Mục đích file: Xác định ngày theo múi giờ Việt Nam cho các kiểm tra liên quan thời điểm học vụ.
// Academic notices and deadlines use the university's local calendar date.
export function universityDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

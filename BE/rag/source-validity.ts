// Quy tắc thời gian của nguồn: không suy ra hiệu lực từ ngày tải lên hay xuất bản trong hệ thống.
export type SourceValidity = {
  issuedOn?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  scopeKey?: string | null;
};
export type ValidityState = "current" | "future" | "expired" | "unknown";

// Ngày phải là ngày lịch thực tế, dùng dạng ISO để so sánh nhất quán giữa SQLite và PostgreSQL.
export function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
export function validateSourceValidity(value: SourceValidity): string | null {
  // Kiểm tra từng ngày có thật trước khi so sánh chuỗi ISO; giá trị trống vẫn được phép.
  for (const field of [value.issuedOn, value.effectiveFrom, value.effectiveUntil])
    if (field && !validIsoDate(field)) return "Ngày phải hợp lệ theo định dạng YYYY-MM-DD.";
  if (value.effectiveFrom && value.effectiveUntil && value.effectiveFrom > value.effectiveUntil)
    return "Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.";
  return null;
}
export function sourceValidityAt(value: SourceValidity, date: string): ValidityState {
  // Dữ liệu thời gian sai không được tuyên bố là còn hiệu lực.
  if (validateSourceValidity(value) || !validIsoDate(date)) return "unknown";
  if (value.issuedOn && date < value.issuedOn) return "future";
  if (value.effectiveFrom && date < value.effectiveFrom) return "future";
  if (value.effectiveUntil && date > value.effectiveUntil) return "expired";
  // Không suy ra thời hạn vô thời hạn khi ngày bắt đầu hoặc kết thúc chưa được xác nhận.
  return value.effectiveFrom && value.effectiveUntil ? "current" : "unknown";
}
// Chỉ so sánh các tài liệu được quản trị viên xác định cùng một nhóm và phạm vi.
export function preferRecentWithinScope<T extends SourceValidity>(sources: T[]): T[] {
  const result = sources.slice();
  const groups = new Map<string, number[]>();
  // Ghi lại vị trí để chỉ sắp xếp trong cùng phạm vi, không trộn nguồn của phạm vi khác.
  sources.forEach((source, index) => {
    if (source.scopeKey) groups.set(source.scopeKey, [...(groups.get(source.scopeKey) || []), index]);
  });
  for (const indexes of groups.values()) {
    // Thiếu ngày thì không khẳng định thứ tự mới/cũ của nhóm.
    if (indexes.some((index) => !sources[index].issuedOn || !sources[index].effectiveFrom || !sources[index].effectiveUntil)) continue;
    const sorted = indexes.map((index) => sources[index]).sort((a, b) => b.issuedOn!.localeCompare(a.issuedOn!));
    indexes.forEach((index, order) => { result[index] = sorted[order]; });
  }
  return result;
}

export function vietnamToday(): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh", year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date());
}
export function currentlyUsable(row: {issued_on?: string | null; effective_from?: string | null; effective_until?: string | null; scope_key?: string | null}): boolean {
  const state = sourceValidityAt({issuedOn:row.issued_on,effectiveFrom:row.effective_from,effectiveUntil:row.effective_until,scopeKey:row.scope_key}, vietnamToday());
  // Trạng thái unknown vẫn được phép xét tiếp nhưng không đồng nghĩa đã xác nhận còn hiệu lực.
  return state !== "expired" && state !== "future";
}

// Với câu hỏi nêu năm, chỉ loại khi khoảng hiệu lực chắc chắn không giao với giai đoạn đó.
// Không tự suy ra ngày bắt đầu học kỳ từ năm học.
export function usableForQuestion(row: {issued_on?: string | null; effective_from?: string | null; effective_until?: string | null; scope_key?: string | null}, question: string): boolean {
  const match = question.match(/\b(20\d{2})(?:\s*[-–/]\s*(20\d{2}))?\b/);
  if (!match) return currentlyUsable(row);
  // Khoảng năm là phạm vi rộng để tìm tài liệu lịch sử, không khẳng định ngày học kỳ.
  const start = `${match[1]}-01-01`, end = `${match[2] || match[1]}-12-31`;
  if (row.issued_on && row.issued_on > end) return false;
  if (row.effective_from && row.effective_from > end) return false;
  if (row.effective_until && row.effective_until < start) return false;
  return true;
}

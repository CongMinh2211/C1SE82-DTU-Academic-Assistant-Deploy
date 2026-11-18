import { routes } from "./routes";

// Liên kết email chỉ nhận UUID và luôn trỏ tới trang góp ý nội bộ.
const feedbackIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validFeedbackId(value: string | string[] | null | undefined) {
  return typeof value === "string" && feedbackIdPattern.test(value) ? value : null;
}
export function feedbackPath(id: string) {
  return `${routes.feedback}?feedback=${encodeURIComponent(id)}`;
}
export function feedbackLoginPath(id: string) {
  return `${routes.login}?feedback=${encodeURIComponent(id)}`;
}

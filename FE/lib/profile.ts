import { z } from "zod";
const cleanLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Không nhập ký tự điều khiển.",
    );
export const profileSchema = z
  .object({
    name: cleanLine(100).refine(
      (value) => value.length >= 2,
      "Họ tên cần ít nhất 2 ký tự.",
    ),
    studentCode: cleanLine(32).refine(
      (value) => !value || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value),
      "Mã sinh viên chưa hợp lệ.",
    ),
    cohort: z
      .string()
      .trim()
      .regex(/^(?:K\s*)?\d{1,3}$|^$/i, "Nhập khóa theo dạng K29 hoặc 29.")
      .transform((value) => (value ? `K${value.replace(/^K\s*/i, "")}` : "")),
    major: cleanLine(160),
  })
  .strict();

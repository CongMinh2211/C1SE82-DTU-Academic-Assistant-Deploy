// Mục đích file: Kiểm thử: Thứ tự nhà cung cấp AI và trường hợp thiếu khóa cấu hình.
import test from "node:test";
import assert from "node:assert/strict";
import { academicModel } from "../../BE/rag/model";

// Kiểm tra thay đổi dịch vụ chính và bỏ qua nhà cung cấp chưa có khóa.
test("thứ tự dự phòng và nhà cung cấp thiếu key", () => {
  const keys = [
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "AI_PRIMARY_PROVIDER",
  ] as const;
  const before = keys.map((key) => process.env[key]);
  try {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.AI_PRIMARY_PROVIDER = "gemini";
    assert.deepEqual(
      academicModel().map((provider) => provider.id),
      ["gemini", "openai"],
    );
    process.env.AI_PRIMARY_PROVIDER = "openai";
    assert.deepEqual(
      academicModel().map((provider) => provider.id),
      ["openai", "gemini"],
    );
    delete process.env.OPENAI_API_KEY;
    assert.deepEqual(
      academicModel().map((provider) => provider.id),
      ["gemini"],
    );
  } finally {
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
  }
});

// Mục đích file: Kiểm thử: Điều kiện cấu hình cần thiết để bật đăng nhập Google.
import test from "node:test";
import assert from "node:assert/strict";
import { googleOAuthConfig } from "../../BE/google-config";

// Kiểm tra thiếu từng trường cấu hình và trường hợp đủ cả ID lẫn secret.
test("Google chỉ được bật khi có đủ client ID và secret", () => {
  assert.equal(googleOAuthConfig({}), null);
  assert.equal(googleOAuthConfig({ GOOGLE_CLIENT_ID: "id" }), null);
  assert.equal(
    googleOAuthConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: " " }),
    null,
  );
  assert.deepEqual(
    googleOAuthConfig({
      GOOGLE_CLIENT_ID: " id ",
      GOOGLE_CLIENT_SECRET: " secret ",
    }),
    {
      clientId: "id",
      clientSecret: "secret",
    },
  );
});

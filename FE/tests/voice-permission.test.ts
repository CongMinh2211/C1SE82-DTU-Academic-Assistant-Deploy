import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";
import { speechErrorMessage } from "../lib/voice-errors";

test("trang cùng nguồn có thể yêu cầu micro, camera vẫn bị chặn", async () => {
  const rules = await nextConfig.headers!();
  const policy = rules.flatMap(rule => rule.headers).find(header => header.key === "Permissions-Policy")?.value || "";
  assert.match(policy, /microphone=\(self\)/);
  assert.match(policy, /camera=\(\)/);
  assert.doesNotMatch(policy, /microphone=\(\)/);
});
test("dịch vụ nhận diện bị chặn không bị báo nhầm là thiếu quyền micro", () => {
  assert.match(speechErrorMessage("service-not-allowed"), /dịch vụ nhận diện/i);
  assert.match(speechErrorMessage("audio-capture"), /micro hoạt động/i);
  assert.match(speechErrorMessage("network"), /mạng/i);
  assert.match(speechErrorMessage("not-allowed"), /quyền/i);
});

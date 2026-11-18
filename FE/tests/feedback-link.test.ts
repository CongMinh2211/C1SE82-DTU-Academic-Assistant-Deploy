import { strict as assert } from "node:assert";
import test from "node:test";
import { feedbackLoginPath, feedbackPath, validFeedbackId } from "../lib/feedback-link";
const id = "550e8400-e29b-41d4-a716-446655440000";
test("accepts feedback UUID and builds fixed internal routes", () => {
  assert.equal(validFeedbackId(id), id);
  assert.equal(feedbackPath(id), "/sinh-vien/gop-y?feedback=550e8400-e29b-41d4-a716-446655440000");
  assert.equal(feedbackLoginPath(id), "/dang-nhap?feedback=550e8400-e29b-41d4-a716-446655440000");
});
test("rejects external, malformed and repeated feedback values", () => {
  assert.equal(validFeedbackId("https://evil.example/?next=/admin"), null);
  assert.equal(validFeedbackId("../../admin"), null);
  assert.equal(validFeedbackId("not-a-uuid"), null);
  assert.equal(validFeedbackId([id, "bad"]), null);
});

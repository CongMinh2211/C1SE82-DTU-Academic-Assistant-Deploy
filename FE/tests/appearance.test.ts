// Kiểm tra giá trị lưu trữ không hợp lệ không làm lỗi trang và chế độ hệ thống đổi đúng theo thiết bị.
import test from "node:test";
import assert from "node:assert/strict";
import { appearanceKey, parseAppearance, applyAppearance } from "../lib/appearance";
test("cài đặt được tách theo tài khoản và xử lý dữ liệu lỗi", () => {
  assert.notEqual(appearanceKey("a"), appearanceKey("b"));
  assert.deepEqual(parseAppearance("không hợp lệ"), {theme:"light",size:"normal"});
  assert.deepEqual(parseAppearance('{"theme":"bad","size":"extra"}'), {theme:"light",size:"extra"});
});
test("chế độ theo thiết bị và cỡ chữ được áp dụng", () => {
  const root = {dataset:{}} as unknown as HTMLElement;
  applyAppearance({theme:"system",size:"large"}, true, root);
  assert.equal(root.dataset.theme, "dark"); assert.equal(root.dataset.textSize, "large");
  applyAppearance({theme:"light",size:"normal"}, true, root);
  assert.equal(root.dataset.theme, "light");
});

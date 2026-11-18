import { test } from "node:test";
import assert from "node:assert/strict";
import { isGoogleMapsLink } from "../lib/map-link";
test("chấp nhận link chỉ đường hoặc tìm kiếm địa điểm Google Maps", () => {
  assert.equal(isGoogleMapsLink("https://www.google.com/maps/dir/?api=1&destination=120%20Hoang%20Minh%20Thao"), true);
  assert.equal(isGoogleMapsLink("https://www.google.com/maps/search/?api=1&query=254%20Nguyen%20Van%20Linh"), true);
});
test("không biến địa chỉ giả mạo hoặc thiếu điểm đến thành link bản đồ", () => {
  assert.equal(isGoogleMapsLink("https://www.google.com.evil.test/maps/dir/?api=1&destination=a"), false);
  assert.equal(isGoogleMapsLink("https://www.google.com/maps/dir/?api=1"), false);
});

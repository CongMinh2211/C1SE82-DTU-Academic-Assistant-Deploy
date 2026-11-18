import {test} from "node:test";
import assert from "node:assert/strict";
import {passwordMode} from "../lib/password-mode";
test("hiển thị thao tác mật khẩu phù hợp phương thức đăng nhập",()=>{
 // Lần lượt kiểm tra lúc đang tải, chỉ Google, có mật khẩu, liên kết cả hai và nhà cung cấp lạ.
 assert.equal(passwordMode(null),"loading");
 assert.equal(passwordMode(["google"]),"create");
 assert.equal(passwordMode(["credential"]),"change");
 assert.equal(passwordMode(["google","credential"]),"change");
 assert.equal(passwordMode([]),"unavailable");
 assert.equal(passwordMode(["unknown"]),"unavailable");
});

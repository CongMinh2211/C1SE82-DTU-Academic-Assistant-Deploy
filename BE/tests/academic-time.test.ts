// Mục đích file: Kiểm thử: Múi giờ Việt Nam và ranh giới ngày khi xác định thời điểm học vụ.
import test from "node:test";
import assert from "node:assert/strict";
import { universityDate } from "../../BE/rag/date";
// Kiểm tra ngày theo giờ Việt Nam khi thời điểm UTC nằm sát ranh giới ngày.
test("deadline reasoning uses the Vietnamese date across the UTC date boundary", () => {
  assert.equal(
    universityDate(new Date("2026-10-24T18:00:00.000Z")),
    "2026-10-25",
  );
  assert.equal(
    universityDate(new Date("2026-10-24T16:00:00.000Z")),
    "2026-10-24",
  );
});

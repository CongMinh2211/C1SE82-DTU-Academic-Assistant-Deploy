import test from "node:test";
import assert from "node:assert/strict";
import { preferRecentWithinScope, usableForQuestion, sourceValidityAt, validIsoDate, validateSourceValidity } from "../rag/source-validity";

test("xác thực ngày và khoảng hiệu lực", () => {
  assert.equal(validIsoDate("2026-02-30"), false);
  assert.equal(validIsoDate("2024-02-29"), true);
  assert.ok(validateSourceValidity({effectiveFrom:"2026-02-01", effectiveUntil:"2026-01-01"}));
});
test("ngày hiệu lực tính cả hai mốc, không mặc định nguồn thiếu thông tin là hiện hành", () => {
  const v = {issuedOn:"2026-01-01", effectiveFrom:"2026-02-01", effectiveUntil:"2026-02-28"};
  assert.equal(sourceValidityAt(v,"2026-01-31"),"future");
  assert.equal(sourceValidityAt(v,"2026-02-01"),"current");
  assert.equal(sourceValidityAt(v,"2026-02-28"),"current");
  assert.equal(sourceValidityAt(v,"2026-03-01"),"expired");
  assert.equal(sourceValidityAt({issuedOn:"2026-01-01"},"2026-02-01"),"unknown");
  assert.equal(sourceValidityAt({effectiveFrom:"2026-01-01"},"2026-02-01"),"unknown");
});

test("chỉ ưu tiên ngày ban hành trong cùng nhóm phạm vi đã xác nhận", () => {
  const source = [
    {scopeKey:"k29", issuedOn:"2024-01-01", effectiveFrom:"2024-01-01",effectiveUntil:"2030-01-01", label:"cũ"},
    {scopeKey:"k30", issuedOn:"2026-01-01", effectiveFrom:"2024-01-01",effectiveUntil:"2030-01-01", label:"khác khóa"},
    {scopeKey:"k29", issuedOn:"2025-01-01", effectiveFrom:"2024-01-01",effectiveUntil:"2030-01-01", label:"mới"},
  ];
  assert.deepEqual(preferRecentWithinScope(source).map(x => x.label), ["mới", "khác khóa", "cũ"]);
  assert.deepEqual(preferRecentWithinScope([{scopeKey:"x",issuedOn:null},{scopeKey:"x",issuedOn:"2026-01-01"}]),[{scopeKey:"x",issuedOn:null},{scopeKey:"x",issuedOn:"2026-01-01"}]);
});

test("tra cứu năm cũ không dùng nguồn sai kỳ và cho phép nguồn cũ trùng kỳ", () => {
  const old = {issued_on:"2023-01-01",effective_from:"2023-01-01",effective_until:"2024-12-31"};
  assert.equal(usableForQuestion(old,"Học phí năm 2023-2024"),true);
  assert.equal(usableForQuestion(old,"Học phí năm 2026-2027"),false);
  assert.equal(usableForQuestion(old,"Học phí hiện nay"),false);
});

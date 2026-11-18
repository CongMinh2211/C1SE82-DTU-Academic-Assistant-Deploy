import test from "node:test";
import assert from "node:assert/strict";
import { preferRecentWithinScope, sourceValidityAt } from "../rag/source-validity";

test("Equal issue dates preserve retrieval order and leave the input untouched", () => {
  const metadata = { scopeKey: "k29", effectiveFrom: "2025-01-01", effectiveUntil: "2027-12-31" };
  const records = ["old", "first", "second"].map((label, i) => ({
    ...metadata, label, issuedOn: i === 0 ? "2025-01-01" : "2026-01-01",
  }));
  assert.deepEqual(preferRecentWithinScope(records).map(r => r.label), ["first", "second", "old"]);
  assert.deepEqual(records.map(r => r.label), ["old", "first", "second"]);
});

test("A future issue date takes precedence over an earlier effective start", () => {
  const dates = { issuedOn: "2026-09-15", effectiveFrom: "2026-09-01", effectiveUntil: "2027-08-31" };
  assert.equal(sourceValidityAt(dates, "2026-09-14"), "future");
  assert.equal(sourceValidityAt(dates, "2026-09-15"), "current");
});

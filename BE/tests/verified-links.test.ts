// Mục đích file: Kiểm thử: Chỉ cho phép liên kết thực sự thuộc về nguồn được trích dẫn.
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDraft,
  draftValidationIssues,
  draftSchema,
} from "../../BE/rag/answer";
import type { Evidence } from "../../BE/rag/retrieve";
const source: Evidence = {
  id: "W1",
  chunkId: "web:source",
  documentId: "web",
  revisionId: "web",
  title: "Verified source fixture",
  version: 1,
  page: 1,
  pageEnd: 1,
  section: "",
  scope: "fixture",
  score: 1,
  text: "Duy Tan University was founded in 1994.",
  url: "https://www.timeshighereducation.com/world-university-rankings/duy-tan-university",
  sourceTier: "institutional",
};
// Chỉ URL thuộc nguồn thực tế được trích dẫn mới xuất hiện trong nội dung có căn cứ.
test("only a URL belonging to the cited, fetched source may appear in factual text", () => {
  const draft = draftSchema.parse({
    status: "answered",
    claims: [
      {
        text: `Theo nguồn, trường thành lập năm 1994: ${source.url}.`,
        evidence: [{ sourceId: "W1" }],
      },
    ],
    followUp: "",
  });
  assert.equal(validateDraft(draft, [source]), true);
  draft.claims[0].text =
    "Trường thành lập 1994. https://invented.example/claim";
  assert.equal(validateDraft(draft, [source]), false);
  assert.ok(
    draftValidationIssues(draft, [source]).includes(
      "claim_0:url_not_in_cited_sources",
    ),
  );
  draft.claims[0].text = source.url!;
  draft.claims[0].evidence = [{ sourceId: "NOT-GIVEN" }];
  assert.equal(validateDraft(draft, [source]), false);
  assert.ok(
    draftValidationIssues(draft, [source]).includes(
      "claim_0:unknown_source_id",
    ),
  );
});

// Mục đích file: Kiểm thử: Thử sửa câu trả lời bị từ chối và kiểm tra lại nguồn sau mỗi lần sửa.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { groundAnswer } from "../../BE/rag/answer";
import type { Evidence } from "../../BE/rag/retrieve";

const evidence: Evidence[] = [
  {
    id: "S1",
    chunkId: "source-row",
    documentId: "TEST",
    revisionId: "v1",
    title: "Controlled fixture",
    version: 1,
    page: 1,
    pageEnd: 1,
    section: "",
    scope: "test only",
    text: "Mức thử nghiệm có căn cứ: 100 đơn vị.",
    score: 1,
  },
];
const draft = (amount: number, sourceId = "S1") => ({
  status: "answered",
  claims: [
    { text: `Mức thử nghiệm là ${amount} đơn vị.`, evidence: [{ sourceId }] },
  ],
  followUp: "",
});
const verdict = (supported: boolean) => ({
  complete: true,
  followUpSafe: true,
  checks: [
    {
      index: 0,
      supported,
      reason: supported
        ? "Supported by the cited fixture"
        : "The amount differs from the source. Correct it using the source.",
    },
  ],
});
async function withProvider(
  responses: unknown[],
  run: (calls: () => number) => Promise<void>,
) {
  let count = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
      void _;
    }
    const content = responses[count++];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "qc-response",
        object: "chat.completion",
        created: 1,
        model: "qc-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(content) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const old = process.env.SAVEGATE_BASE_URL;
  const oldKey = process.env.SAVEGATE_API_KEY;
  process.env.SAVEGATE_API_KEY = "qc-local-fixture";
  process.env.SAVEGATE_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  try {
    await run(() => count);
  } finally {
    if (old === undefined) delete process.env.SAVEGATE_BASE_URL;
    else process.env.SAVEGATE_BASE_URL = old;
    if (oldKey === undefined) delete process.env.SAVEGATE_API_KEY;
    else process.env.SAVEGATE_API_KEY = oldKey;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
// Mô phỏng câu trả lời sai, yêu cầu sửa một lần và kiểm tra bản sửa độc lập.
test("a rejected claim is revised once and the revision is independently checked", async () => {
  await withProvider(
    [draft(999), verdict(false), draft(100), verdict(true)],
    async (calls) => {
      const answer = await groundAnswer(
        "Mức thử nghiệm bao nhiêu?",
        [],
        evidence,
      );
      assert.equal(calls(), 4);
      assert.equal(answer.reason, "grounded_repaired");
      assert.equal(answer.status, "answered");
      assert.match(answer.content, /100/);
      assert.ok(!answer.content.includes("999"));
      assert.equal(answer.citations[0].quote, evidence[0].text);
    },
  );
});
// Sau hai lần kiểm tra thất bại, không được hiển thị thông tin thiếu căn cứ.
test("two failed checks stop the repair loop without showing unsupported facts", async () => {
  await withProvider(
    [draft(999), verdict(false), draft(888), verdict(false)],
    async (calls) => {
      const answer = await groundAnswer(
        "Mức thử nghiệm bao nhiêu?",
        [],
        evidence,
      );
      assert.equal(calls(), 4);
      assert.equal(answer.status, "insufficient");
      assert.equal(answer.citations.length, 0);
      assert.ok(!/999|888/.test(answer.content));
    },
  );
});
// Mã trích dẫn do mô hình tự tạo phải bị loại trước khi trả lời sinh viên.
test("invented citation IDs cannot survive a retry or reach a user", async () => {
  await withProvider(
    [draft(999, "INVENTED"), draft(999, "INVENTED")],
    async (calls) => {
      const answer = await groundAnswer(
        "Mức thử nghiệm bao nhiêu?",
        [],
        evidence,
      );
      assert.equal(calls(), 2);
      assert.equal(answer.status, "insufficient");
      assert.equal(answer.citations.length, 0);
      assert.ok(!/999|INVENTED/.test(answer.content));
    },
  );
});

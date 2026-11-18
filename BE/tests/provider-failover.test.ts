// Mục đích file: Kiểm thử: Chuyển nhà cung cấp dự phòng khi lỗi xác thực, giới hạn hoặc lỗi dịch vụ.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Agent } from "@mastra/core/agent";

// Máy chủ giả lập lỗi nhà cung cấp chính; xác nhận nhà cung cấp dự phòng được gọi.
test("nhà cung cấp dự phòng được thử khi nguồn chính trả 401, 429 hoặc 503", async () => {
  let status = 429,
    backupCalls = 0,
    bothFail = false;
  const server = createServer((req, res) => {
    req.resume();
    if (req.url?.startsWith("/primary/")) {
      if (status === 0) return;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ error: { message: "simulated provider failure" } }),
      );
      return;
    }
    backupCalls++;
    if (bothFail) { res.writeHead(429, { "content-type": "application/json" }); res.end(JSON.stringify({error:{message:"quota exhausted"}})); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "test",
        object: "chat.completion",
        created: 1,
        model: "test",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No local port");
    const config = (name: string) => ({
      id: `custom/test` as const,
      url: `http://127.0.0.1:${address.port}/${name}`,
      apiKey: "test",
      api: "chat" as const,
    });
    const agent = new Agent({
      id: "failover-test",
      name: "failover-test",
      instructions: "test",
      model: [
        { model: config("primary"), maxRetries: 0, modelSettings: { timeout: { stepMs: 500 } } },
        { model: config("backup"), maxRetries: 0, modelSettings: { timeout: { stepMs: 3000 } } },
      ],
    });
    for (const code of [401, 429, 503]) {
      status = code;
      const result = await agent.generate("test", {
        modelSettings: { maxRetries: 0 },
        maxSteps: 1,
      });
      assert.equal(result.text, "ok");
    }
    assert.equal(backupCalls, 3);
    status = 0;
    assert.equal((await agent.generate("test", { modelSettings: { maxRetries: 0 }, maxSteps: 1 })).text, "ok");
    bothFail = true; status = 429;
    await assert.rejects(agent.generate("test", { modelSettings: { maxRetries: 0 }, maxSteps: 1 }));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

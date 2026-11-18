import { answerQuestion } from "../BE/rag/answer";
import { qualityCases, qualityChecks } from "./chat-quality-cases";
import { mkdir, writeFile } from "node:fs/promises";

const filter = process.env.QC_CASES?.split(",");
const selected = qualityCases.filter(
  (c) => !filter || filter.includes(c.id) || filter.includes(c.group),
);
if (!selected.length) throw new Error("No matching QC cases");
process.env.WEB_SEARCH_PROVIDER = "parallel_free";
const results: unknown[] = [];
let next = 0,
  failures = 0;
await mkdir("test-results", { recursive: true });
const report = process.env.QC_REPORT || "test-results/chat-quality.json";
async function worker() {
  while (next < selected.length) {
    const item = selected[next++],
      started = Date.now();
    let answer, error;
    try {
      answer = await answerQuestion(
        item.question,
        item.history || [],
        item.web || false,
        AbortSignal.timeout(120000),
      );
    } catch (cause) {
      error = cause instanceof Error ? cause.name : "UnknownError";
    }
    const checks = answer
      ? qualityChecks(item, answer)
      : { requestCompleted: false };
    const failed = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);
    if (failed.length) failures++;
    results.push({
      id: item.id,
      group: item.group,
      question: item.question,
      history: item.history,
      passed: !failed.length,
      checks,
      latencyMs: Date.now() - started,
      answer,
      error,
    });
    console.log(
      JSON.stringify({
        id: item.id,
        passed: !failed.length,
        failed,
        status: answer?.status,
        reason: answer?.reason,
        ms: Date.now() - started,
      }),
    );
    await writeFile(
      report,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          total: selected.length,
          completed: results.length,
          passed: results.length - failures,
          failures,
          cases: results,
        },
        null,
        2,
      ),
    );
  }
}
await Promise.all([worker(), worker()]);
process.exitCode = failures ? 1 : 0;
// Database pools may remain open in cloud mode; all work has been awaited.
setTimeout(() => process.exit(process.exitCode || 0), 200).unref();

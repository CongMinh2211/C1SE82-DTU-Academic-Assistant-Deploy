import { writeFile } from "node:fs/promises";
import { academicTopics } from "../FE/lib/academic-topics";
import { answerQuestion } from "../BE/rag/answer";
const cases = academicTopics.flatMap((topic) =>
    topic.questions.map((question) => ({ topic: topic.label, question })),
  ),
  results: { passed: boolean; [key: string]: unknown }[] = [];
let cursor = 0;
async function worker() {
  while (cursor < cases.length) {
    const index = cursor++,
      item = cases[index],
      start = Date.now();
    try {
      const answer = await answerQuestion(
        item.question,
        [],
        false,
        AbortSignal.timeout(120000),
      );
      const normalized = answer.content.replace(/[.,\s]/g, "");
      const checks = {
        answered: answer.status === "answered",
        cited: answer.citations.length > 0,
        noError: !["error", "processing"].includes(answer.status),
        ...(index === 2
          ? {
              creditRatios:
                /2\s*\/\s*3/.test(answer.content) &&
                /3\s*\/\s*2/.test(answer.content),
            }
          : {}),
        ...(index === 3
          ? {
              correctTuition:
                normalized.includes("14900000") &&
                normalized.includes("931250"),
              programmeScoped: /CMU/.test(answer.content),
              academicYear: /2026\s*[–-]\s*2027/.test(answer.content),
            }
          : {}),
        ...(index === 5
          ? {
              gradeBands:
                /xuất sắc/i.test(answer.content) &&
                /giỏi/i.test(answer.content) &&
                /trung bình/i.test(answer.content),
            }
          : {}),
        ...(index === 7
          ? { electiveThesisThreshold: /3[.,]2/.test(answer.content) }
          : {}),
        ...(index === 8
          ? {
              defenceVersusGraduation:
                /bảo vệ/i.test(answer.content) &&
                /tốt nghiệp/i.test(answer.content),
            }
          : {}),
      };
      const passed = Object.values(checks).every(Boolean);
      results.push({
        index: index + 1,
        ...item,
        passed,
        checks,
        latencyMs: Date.now() - start,
        answer,
      });
      console.log(JSON.stringify({ case: index + 1, passed, checks }));
    } catch (e) {
      results.push({
        index: index + 1,
        ...item,
        passed: false,
        error: (e as Error).message,
      });
      console.log(JSON.stringify({ case: index + 1, passed: false }));
    }
    await writeFile(
      "test-results/review-question-quality.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: results.every((r) => r.passed),
          completed: results.length,
          total: cases.length,
          results,
        },
        null,
        2,
      ),
    );
  }
}
await Promise.all([worker(), worker()]);

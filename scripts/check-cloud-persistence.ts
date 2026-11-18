import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pool, db } from "../BE/db";
const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
const client = await pool().connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables: Record<string, { rows: number; sha256: string }> = {};
  for (const table of [
    "documents",
    "revisions",
    "chunks",
    "faqs",
    "conversations",
    "messages",
    "feedback",
    "audit",
    "traces",
    "academic_e5_v1",
  ]) {
    const records = (await client.query(`SELECT * FROM "${table}" ORDER BY id`))
      .rows;
    tables[table] = {
      rows: records.length,
      sha256: createHash("sha256")
        .update(JSON.stringify(records))
        .digest("hex"),
    };
  }
  await client.query("COMMIT");
  const report = { at: new Date().toISOString(), tables };
  if (phase === "before")
    await writeFile(
      "test-results/cloud-before-redeploy.json",
      JSON.stringify(report, null, 2),
    );
  else {
    const before = JSON.parse(
      await readFile("test-results/cloud-before-redeploy.json", "utf8"),
    );
    const passed = JSON.stringify(tables) === JSON.stringify(before.tables);
    await writeFile(
      "test-results/cloud-after-redeploy.json",
      JSON.stringify({ ...report, passed }, null, 2),
    );
    if (!passed)
      throw new Error(
        "Persistent data changed; inspect before and after reports",
      );
  }
  console.log(
    JSON.stringify({
      phase,
      verified: true,
      tables: Object.keys(tables).length,
    }),
  );
} finally {
  client.release();
  await db().close();
}

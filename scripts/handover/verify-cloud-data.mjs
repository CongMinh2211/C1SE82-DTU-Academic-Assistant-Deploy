import assert from "node:assert/strict";
import { Pool, types } from "pg";
types.setTypeParser(20, (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error("Unsafe integer");
  return n;
});
import { manifest, fileEnv, readJson, safePath, fail } from "./common.mjs";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
const norm = (v) =>
  v instanceof Date
    ? v.toISOString()
    : Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, norm(v[k])]),
          )
        : v;
let pool;
try {
  const env = await fileEnv(process.argv[2] || ".env.cloud.local");
  const url = new URL(env.DATABASE_URL_UNPOOLED);
  url.searchParams.set(
    "sslmode",
    process.env.HANDOVER_TEST_POSTGRES === "1" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
      ? "disable"
      : "verify-full",
  );
  pool = new Pool({ connectionString: url.href, max: 1 });
  const m = await manifest();
  let rows = 0;
  for (const [table, entry] of Object.entries(m.tables)) {
    const expected = await readJson(safePath(entry.file));
    const actual = (await pool.query(`SELECT * FROM ${quote(table)}`)).rows;
    const serialize = (r) =>
      JSON.stringify(
        norm({
          ...r,
          ...(table === "academic_e5_v1"
            ? { embedding: JSON.parse(r.embedding).map(Math.fround) }
            : {}),
        }),
      );
    const values = new Set(actual.map(serialize));
    for (const record of expected)
      assert.ok(
        values.has(serialize(record)),
        "Snapshot row changed: " + table,
      );
    rows += expected.length;
  }
  console.log(
    JSON.stringify({
      passed: true,
      tables: Object.keys(m.tables).length,
      originalRowsVerified: rows,
      snapshot: m.at,
    }),
  );
} catch (e) {
  fail(e);
} finally {
  if (pool) await pool.end();
}

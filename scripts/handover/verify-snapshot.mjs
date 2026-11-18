import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { manifest, readJson, safePath, sha, fail } from "./common.mjs";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
const sorted = (v) =>
  v instanceof Date
    ? v.toISOString()
    : Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sorted(v[k])]),
          )
        : v;
const serial = (v) => JSON.stringify(sorted(v));
try {
  const dir = path.resolve(process.argv[2] || "data");
  const m = await manifest();
  const schema = await readJson(safePath(m.schema.file));
  const sql = new Database(path.join(dir, "academic.sqlite"), {
    readonly: true,
  });
  let rowsVerified = 0;
  for (const [table, meta] of Object.entries(m.tables)) {
    if (table === "academic_e5_v1") continue;
    const expected = await readJson(safePath(meta.file));
    const columns = schema.filter(
      (c) =>
        c.table_name === table &&
        c.column_name !== "_ordinal" &&
        c.is_generated === "NEVER",
    );
    const types = new Map(
      sql
        .prepare(`PRAGMA table_info(${quote(table)})`)
        .all()
        .map((c) => [c.name, c.type]),
    );
    const actual = sql
      .prepare(
        `SELECT ${columns.map((c) => quote(c.column_name)).join(",")} FROM ${quote(table)}`,
      )
      .all();
    const normalized = expected.map((row) =>
      Object.fromEntries(
        columns.map((c) => {
          let v = row[c.column_name];
          if (v !== null) {
            if (typeof v === "boolean") v = v ? 1 : 0;
            else if (
              c.data_type.startsWith("timestamp") &&
              /int/i.test(types.get(c.column_name) || "")
            )
              v = Date.parse(v);
            else if (typeof v === "object") v = JSON.stringify(v);
            else if (
              /int|double|numeric/.test(c.data_type) &&
              typeof v === "string" &&
              /NUMERIC|INTEGER|REAL/i.test(types.get(c.column_name) || "")
            )
              v = Number(v);
          }
          return [c.column_name, v];
        }),
      ),
    );
    assert.deepEqual(
      actual.map(serial).sort(),
      normalized.map(serial).sort(),
      "Dữ liệu khác snapshot: " + table,
    );
    rowsVerified += expected.length;
  }
  sql.close();
  const vectors = new Database(path.join(dir, "vectors.sqlite"), {
    readonly: true,
  });
  const actual = vectors
    .prepare("SELECT vector_id,embedding,metadata FROM academic_e5_v1")
    .all();
  const expected = await readJson(safePath(m.tables.academic_e5_v1.file));
  assert.equal(actual.length, expected.length);
  const byId = new Map(actual.map((v) => [v.vector_id, v]));
  for (const row of expected) {
    const found = byId.get(row.vector_id);
    assert.ok(found);
    assert.equal(serial(JSON.parse(found.metadata)), serial(row.metadata));
    const e = JSON.parse(row.embedding);
    assert.equal(found.embedding.length, 384 * 4);
    for (let i = 0; i < 384; i++)
      assert.equal(
        found.embedding.readFloatLE(i * 4),
        Math.fround(e[i]),
        "Vector component changed",
      );
  }
  vectors.close();
  for (const [logical, e] of Object.entries(m.files))
    assert.equal(
      sha(await readFile(path.join(dir, logical))),
      e.sha256,
      "File khác snapshot: " + logical,
    );
  console.log(
    JSON.stringify({
      passed: true,
      snapshot: m.at,
      tables: Object.keys(m.tables).length - 1,
      rowsVerified,
      vectors: expected.length,
      floatComponentsVerified: expected.length * 384,
      files: Object.keys(m.files).length,
    }),
  );
} catch (e) {
  fail(e);
}

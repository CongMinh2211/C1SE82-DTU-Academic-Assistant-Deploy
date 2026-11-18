import { readFile, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PgVector } from "@mastra/pg";
import { get, put } from "@vercel/blob";
import {
  root,
  fileEnv,
  environment,
  requireValues,
  verifyBundle,
  readJson,
  safePath,
  sha,
  fail,
} from "./common.mjs";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
let pool, client, vector;
async function restore() {
  const index = process.argv.indexOf("--env");
  if (index < 0 || !process.argv[index + 1])
    throw new Error("Chỉ phục hồi vào cloud mới: --env .env.target.local");
  const targetFile = process.argv[index + 1];
  const target = await fileEnv(targetFile);
  const env = { ...(await environment("cloud")), ...target };
  requireValues(target, [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "BLOB_READ_WRITE_TOKEN",
    "BETTER_AUTH_URL",
  ]);
  requireValues(env, ["BETTER_AUTH_SECRET", "SAVEGATE_API_KEY"]);
  const m = await verifyBundle({ models: false });
  const url = new URL(target.DATABASE_URL_UNPOOLED);
  const localTest =
    process.env.HANDOVER_TEST_POSTGRES === "1" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  url.searchParams.set("sslmode", localTest ? "disable" : "verify-full");
  Object.assign(process.env, env, { DATABASE_URL: url.href });
  pool = new Pool({
    connectionString: url.href,
    max: 2,
    connectionTimeoutMillis: 15000,
  });
  const source = await fileEnv(".env.cloud.local");
  const original = new URL(source.DATABASE_URL_UNPOOLED);
  if (
    !localTest &&
    target.BLOB_READ_WRITE_TOKEN === source.BLOB_READ_WRITE_TOKEN
  )
    throw new Error(
      "Cloud mới cần Blob đích riêng, không dùng token Blob production gốc",
    );
  if (url.hostname === original.hostname && url.pathname === original.pathname)
    throw new Error(
      "Từ chối phục hồi đè database production đi kèm. Chọn database mới.",
    );
  const hasMarker = (
    await pool.query("SELECT to_regclass('public.cloud_migrations') t")
  ).rows[0].t;
  if (hasMarker) {
    const saved = await pool.query(
      "SELECT id FROM cloud_migrations WHERE id=$1",
      ["handover:" + m.manifestHash],
    );
    if (saved.rowCount) {
      console.log(
        JSON.stringify({ event: "cloud_data_preserved", snapshot: m.at }),
      );
      return;
    }
  }
  const existing = (
    await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('user','documents','messages')",
    )
  ).rows;
  for (const { tablename } of existing)
    if (
      Number(
        (await pool.query(`SELECT count(*) n FROM ${quote(tablename)}`)).rows[0]
          .n,
      ) > 0
    )
      throw new Error("Database đích có dữ liệu. Không ghi đè: " + tablename);
  const { getAuth } = await import("../../BE/auth.ts");
  const { getMigrations } = await import("better-auth/db/migration");
  await (
    await getMigrations({ ...getAuth().options, database: pool })
  ).runMigrations();
  await pool.query(
    await readFile(path.join(root, "migrations/001_cloud.sql"), "utf8"),
  );
  vector = new PgVector({
    id: "handover-restore",
    connectionString: url.href,
    max: 1,
  });
  await vector.createIndex({
    indexName: "academic_e5_v1",
    dimension: 384,
    metric: "cosine",
  });
  const schema = await readJson(safePath(m.schema.file));
  const priority = [
    "user",
    "account",
    "session",
    "verification",
    "rateLimit",
    "documents",
    "revisions",
    "chunks",
    "chunks_fts",
    "jobs",
    "conversations",
    "messages",
    "feedback",
    "faqs",
    "audit",
    "traces",
    "rate_limits",
    "chat_leases",
    "upload_grants",
    "cloud_migrations",
    "cloud_index_runs",
    "academic_e5_v1",
  ];
  const names = [
    ...priority.filter((n) => m.tables[n]),
    ...Object.keys(m.tables).filter((n) => !priority.includes(n)),
  ];
  for (const [logical, entry] of Object.entries(m.files)) {
    if (!/^(sources|metadata)\/[\w.-]+$/.test(logical))
      throw new Error("Đường dẫn nguồn không hợp lệ");
    if (localTest && process.env.HANDOVER_TEST_FILES_DIR) {
      const dest = path.join(process.env.HANDOVER_TEST_FILES_DIR, logical);
      await mkdir(path.dirname(dest), { recursive: true });
      await cp(safePath(entry.file), dest);
      continue;
    }
    const found = await get(logical, { access: "private", useCache: false });
    if (found && found.statusCode === 200) {
      if (
        sha(Buffer.from(await new Response(found.stream).arrayBuffer())) !==
        entry.sha256
      )
        throw new Error("File đích khác snapshot: " + logical);
    } else
      await put(logical, await readFile(safePath(entry.file)), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
      });
  }
  client = await pool.connect();
  await client.query("BEGIN");
  try {
    for (const table of names) {
      const rows = await readJson(safePath(m.tables[table].file));
      const columns = schema
        .filter((c) => c.table_name === table && c.is_generated === "NEVER")
        .map((c) => c.column_name);
      for (let start = 0; start < rows.length; start += 100) {
        const batch = rows.slice(start, start + 100);
        const keys = columns.filter((k) => Object.hasOwn(batch[0], k));
        const values = [];
        const groups = batch.map(
          (row) =>
            "(" +
            keys
              .map((k) => {
                values.push(row[k]);
                return "$" + values.length;
              })
              .join(",") +
            ")",
        );
        await client.query(
          `INSERT INTO ${quote(table)} (${keys.map(quote).join(",")}) VALUES ${groups.join(",")}`,
          values,
        );
      }
      const count = Number(
        (await client.query(`SELECT count(*) n FROM ${quote(table)}`)).rows[0]
          .n,
      );
      if (count !== m.tables[table].rows)
        throw new Error("Sai số lượng " + table);
      const identity = schema.filter(
        (c) =>
          c.table_name === table &&
          (c.is_identity === "YES" || c.column_default?.startsWith("nextval(")),
      );
      for (const col of identity)
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1,$2),GREATEST(COALESCE((SELECT max(${quote(col.column_name)}) FROM ${quote(table)}),0),1))`,
          [table, col.column_name],
        );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    client = undefined;
  }
  const count = await vector.describeIndex({ indexName: "academic_e5_v1" });
  if (count.count !== m.tables.academic_e5_v1.rows)
    throw new Error("Thiếu vector cloud");
  await pool.query(
    "INSERT INTO cloud_migrations(id,detail_json,completed_at) VALUES ($1,$2,$3)",
    [
      "handover:" + m.manifestHash,
      JSON.stringify({ snapshot: m.at }),
      new Date().toISOString(),
    ],
  );
  console.log(
    JSON.stringify({
      event: "cloud_restore_complete",
      snapshot: m.at,
      tables: names.length,
      vectors: count.count,
      files: Object.keys(m.files).length,
    }),
  );
}
try {
  await restore();
} catch (e) {
  fail(e);
} finally {
  client?.release();
  if (vector) await vector.pool.end();
  if (pool) await pool.end();
}

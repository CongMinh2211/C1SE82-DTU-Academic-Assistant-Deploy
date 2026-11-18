import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { get, list } from "@vercel/blob";
import { pool, db } from "../BE/db";

if (!process.env.DATABASE_URL_UNPOOLED)
  throw new Error("A direct cloud database connection is required");
process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const destination = path.resolve(
  process.argv[2] ||
    `backups/cloud-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
await mkdir(destination, { recursive: false, mode: 0o700 });
const hashes: Record<string, string> = {};
async function save(relative: string, bytes: Buffer | string) {
  const file = path.resolve(destination, relative);
  if (!file.startsWith(destination + path.sep))
    throw new Error("Unsafe backup path");
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, bytes, { mode: 0o600 });
  hashes[relative] = createHash("sha256").update(bytes).digest("hex");
}
const client = await pool().connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows as { tablename: string }[];
  for (const { tablename } of tables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tablename))
      throw new Error("Unexpected table name");
    const records = (await client.query(`SELECT * FROM "${tablename}"`)).rows;
    await save(`database/${tablename}.json`, JSON.stringify(records));
  }
  await client.query("COMMIT");
  let cursor: string | undefined;
  do {
    const result = await list({ limit: 1000, cursor });
    for (const blob of result.blobs) {
      if (!/^(sources|metadata)\/[A-Za-z0-9._-]+$/.test(blob.pathname))
        continue;
      const content = await get(blob.pathname, {
        access: "private",
        useCache: false,
      });
      if (!content || content.statusCode !== 200)
        throw new Error("Missing source during backup");
      await save(
        blob.pathname,
        Buffer.from(await new Response(content.stream).arrayBuffer()),
      );
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  await save(
    "backup-manifest.json",
    JSON.stringify(
      {
        format: 1,
        at: new Date().toISOString(),
        database: "PostgreSQL",
        embeddingModel: "Xenova/multilingual-e5-small",
        embeddingRevision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
        dimensions: 384,
        hashes,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      event: "cloud_backup_complete",
      destination,
      files: Object.keys(hashes).length,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await db().close();
}

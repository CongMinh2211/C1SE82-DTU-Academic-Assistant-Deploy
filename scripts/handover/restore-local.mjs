import { mkdir, cp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LibSQLVector } from "@mastra/libsql";
import {
  root,
  loadEnvironment,
  requireValues,
  verifyBundle,
  exists,
  readJson,
  saveJson,
  safePath,
  fail,
} from "./common.mjs";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
let stage, connection, store;
try {
  const env = await loadEnvironment("local");
  requireValues(env, ["BETTER_AUTH_SECRET", "SAVEGATE_API_KEY"]);
  const m = await verifyBundle();
  const target = env.APP_DATA_DIR;
  const marker = path.join(target, ".handover.json");
  if (await exists(marker)) {
    const saved = await readJson(marker);
    if (saved.manifestHash !== m.manifestHash)
      throw new Error(
        "Dữ liệu đã có dùng snapshot khác. Giữ thư mục hiện tại; chọn HANDOVER_DATA_DIR mới để phục hồi.",
      );
    if (
      !(await exists(path.join(target, "academic.sqlite"))) ||
      !(await exists(path.join(target, "vectors.sqlite")))
    )
      throw new Error("Thiếu database đã phục hồi; dùng thư mục dữ liệu mới.");
    console.log(
      JSON.stringify({
        event: "local_data_preserved",
        snapshot: saved.snapshot,
        counts: saved.counts,
      }),
    );
  } else {
    if (await exists(target))
      throw new Error(
        "Thư mục dữ liệu đã tồn tại và chưa có manifest bàn giao. Dùng HANDOVER_DATA_DIR trống; không ghi đè dữ liệu.",
      );
    stage = target + ".restore-" + randomUUID();
    await mkdir(stage, { recursive: true, mode: 0o700 });
    process.env.APP_DATA_DIR = stage;
    const { db } = await import("../../BE/sqlite.ts");
    connection = db();
    const { getAuth } = await import("../../BE/auth.ts");
    const { getMigrations } = await import("better-auth/db/migration");
    await (await getMigrations(getAuth().options)).runMigrations();
    const schema = await readJson(safePath(m.schema.file));
    const names = Object.keys(m.tables).filter((n) => n !== "academic_e5_v1");
    connection.pragma("foreign_keys = OFF");
    const imported = {};
    connection.transaction(() => {
      for (const table of names) {
        const columns = schema.filter(
          (c) =>
            c.table_name === table &&
            c.column_name !== "_ordinal" &&
            c.is_generated === "NEVER",
        );
        if (
          !connection
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            )
            .get(table)
        ) {
          connection.exec(
            `CREATE TABLE ${quote(table)} (${columns.map((c) => quote(c.column_name) + " " + (/int|numeric|double|boolean/.test(c.data_type) ? "NUMERIC" : "TEXT")).join(",")})`,
          );
        }
        const existing = connection
          .prepare(`PRAGMA table_info(${quote(table)})`)
          .all();
        const known = new Set(existing.map((c) => c.name));
        for (const col of columns)
          if (!known.has(col.column_name))
            connection.exec(
              `ALTER TABLE ${quote(table)} ADD COLUMN ${quote(col.column_name)} TEXT`,
            );
        const info = connection
          .prepare(`PRAGMA table_info(${quote(table)})`)
          .all();
        // Read files synchronously inside the SQLite transaction, before any async vector writes.
        imported[table] = { columns, info };
      }
    })();
    const records = {};
    for (const table of names)
      records[table] = await readJson(safePath(m.tables[table].file));
    connection.transaction(() => {
      for (const table of names) {
        const { columns, info } = imported[table];
        const types = new Map(info.map((c) => [c.name, c.type]));
        const items = records[table].toSorted(
          (a, b) => (a._ordinal || 0) - (b._ordinal || 0),
        );
        for (const record of items) {
          const keys = columns
            .map((c) => c.column_name)
            .filter((k) => Object.hasOwn(record, k));
          const ordinal =
            ["messages", "chunks"].includes(table) &&
            record._ordinal !== undefined;
          const fields = [...(ordinal ? ["rowid"] : []), ...keys];
          const values = [
            ...(ordinal ? [Number(record._ordinal)] : []),
            ...keys.map((k) => {
              const value = record[k];
              if (value === null || value === undefined) return null;
              if (typeof value === "boolean") return value ? 1 : 0;
              const col = columns.find((c) => c.column_name === k);
              if (
                col.data_type.startsWith("timestamp") &&
                /int/i.test(types.get(k) || "")
              )
                return Date.parse(value);
              if (typeof value === "object") return JSON.stringify(value);
              return value;
            }),
          ];
          connection
            .prepare(
              `INSERT INTO ${quote(table)} (${fields.map(quote).join(",")}) VALUES (${values.map(() => "?").join(",")})`,
            )
            .run(...values);
        }
        if (
          connection.prepare(`SELECT count(*) n FROM ${quote(table)}`).get()
            .n !== m.tables[table].rows
        )
          throw new Error("Sai số bản ghi: " + table);
      }
    })();
    connection.pragma("foreign_keys = ON");
    if (connection.pragma("foreign_key_check").length)
      throw new Error("Liên kết dữ liệu không hợp lệ");
    for (const [logical, file] of Object.entries(m.files)) {
      if (!/^(sources|metadata)\/[\w.-]+$/.test(logical))
        throw new Error("Đường dẫn nguồn không hợp lệ");
      const dest = path.join(stage, logical);
      await mkdir(path.dirname(dest), { recursive: true });
      await cp(safePath(file.file), dest);
    }
    await cp(
      path.join(stage, "metadata/corpus-manifest.json"),
      path.join(stage, "corpus-manifest.json"),
    );
    await cp(path.join(root, "knowledge/models"), path.join(stage, "models"), {
      recursive: true,
    });
    const entries = await readJson(safePath(m.tables.academic_e5_v1.file));
    if (new Set(entries.map((v) => v.namespace || "")).size > 1)
      throw new Error("Snapshot có nhiều vector namespace chưa được hỗ trợ");
    store = new LibSQLVector({
      id: "academic-knowledge",
      // Tránh lỗi LibSQL trên Windows ghép file:///D:/... thành D:\\D:\\...
      url: `file:${path.join(stage, "vectors.sqlite").replaceAll("\\", "/")}`,
    });
    await store.createIndex({
      indexName: "academic_e5_v1",
      dimension: 384,
      metric: "cosine",
    });
    for (let i = 0; i < entries.length; i += 64) {
      const batch = entries.slice(i, i + 64);
      const vectors = batch.map((v) =>
        typeof v.embedding === "string" ? JSON.parse(v.embedding) : v.embedding,
      );
      if (vectors.some((v) => v.length !== 384 || !v.every(Number.isFinite)))
        throw new Error("Vector không hợp lệ");
      await store.upsert({
        indexName: "academic_e5_v1",
        ids: batch.map((v) => v.vector_id),
        vectors,
        metadata: batch.map((v) => v.metadata),
      });
    }
    const stats = await store.describeIndex({ indexName: "academic_e5_v1" });
    if (stats.count !== entries.length) throw new Error("Thiếu vector");
    const expected = entries[0];
    const nearest = await store.query({
      indexName: "academic_e5_v1",
      queryVector: JSON.parse(expected.embedding),
      topK: 1,
      includeVector: true,
    });
    if (nearest[0]?.id !== expected.vector_id)
      throw new Error("Vector lookup không khớp");
    await store.close();
    store = undefined;
    connection.pragma("wal_checkpoint(TRUNCATE)");
    connection.close();
    connection = undefined;
    await saveJson(path.join(stage, ".handover.json"), {
      snapshot: m.at,
      manifestHash: m.manifestHash,
      counts: m.counts,
      tables: Object.fromEntries(
        Object.entries(m.tables).map(([k, v]) => [k, v.rows]),
      ),
      vectors: stats.count,
    });
    try {
      await rename(stage, target);
    } catch (error) {
      // Windows đôi khi còn giữ khóa LibSQL trong vài nhịp sau close(), làm rename thư mục báo EPERM.
      // Snapshot đã được kiểm tra đầy đủ nên có thể sao chép sang đích; không ghi đè dữ liệu đã tồn tại.
      if (error?.code !== "EPERM" || (await exists(target))) throw error;
      await cp(stage, target, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await rm(stage, { recursive: true, force: true }).catch(() => {});
    }
    stage = undefined;
    console.log(
      JSON.stringify({
        event: "local_restore_complete",
        snapshot: m.at,
        tables: names.length,
        vectors: stats.count,
        counts: m.counts,
      }),
    );
  }
} catch (e) {
  fail(e);
  if (store) await store.close().catch(() => {});
  if (connection?.open) connection.close();
  if (stage) await rm(stage, { recursive: true, force: true });
}

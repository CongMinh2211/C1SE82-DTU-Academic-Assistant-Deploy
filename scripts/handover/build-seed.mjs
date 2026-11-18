import {
  readFile,
  readdir,
  writeFile,
  mkdir,
  rm,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { fileEnv, sha, saveJson, fail } from "./common.mjs";
try {
  const backup = process.argv[2];
  if (!backup) throw new Error("Cần đường dẫn snapshot từ backup:cloud");
  const old = JSON.parse(
    await readFile(path.join(backup, "backup-manifest.json"), "utf8"),
  );
  const content = new Map(),
    canonical = [],
    files = {},
    tables = {};
  await mkdir("seed/database", { recursive: true });
  await mkdir("seed/files", { recursive: true });
  for (const name of await readdir("knowledge/originals")) {
    const file = "knowledge/originals/" + name;
    const b = await readFile(file);
    content.set(sha(b), file);
    canonical.push({ file, sha256: sha(b) });
  }
  for (const logical of Object.keys(old.hashes)) {
    const bytes = await readFile(path.join(backup, logical)),
      hash = sha(bytes);
    if (hash !== old.hashes[logical])
      throw new Error("Snapshot hỏng: " + logical);
    if (logical.startsWith("database/")) {
      const file = "seed/" + logical;
      await writeFile(file, bytes, { mode: 0o644 });
      await chmod(file, 0o644);
      tables[path.basename(logical, ".json")] = {
        file,
        sha256: hash,
        rows: JSON.parse(bytes).length,
      };
      continue;
    }
    let file = content.get(hash);
    if (!file) {
      file = "seed/files/" + hash + path.extname(logical);
      await writeFile(file, bytes, { mode: 0o644 });
      await chmod(file, 0o644);
      content.set(hash, file);
    }
    files[logical] = { file, sha256: hash, bytes: bytes.length };
  }
  const env = await fileEnv(".env.cloud.local");
  const u = new URL(env.DATABASE_URL_UNPOOLED);
  u.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: u.href, max: 1 });
  try {
    await saveJson(
      "seed/schema.json",
      (
        await pool.query(
          "SELECT table_name,column_name,data_type,udt_name,is_identity,is_generated,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
        )
      ).rows,
    );
  } finally {
    await pool.end();
  }
  async function walk(d) {
    const all = [];
    for (const e of await readdir(d, { withFileTypes: true }))
      all.push(
        ...(e.isDirectory()
          ? await walk(d + "/" + e.name)
          : [d + "/" + e.name]),
      );
    return all;
  }
  const models = [];
  for (const file of await walk("knowledge/models"))
    models.push({ file, sha256: sha(await readFile(file)) });
  const docs = JSON.parse(await readFile(tables.documents.file, "utf8"));
  const chunks = JSON.parse(await readFile(tables.chunks.file, "utf8"));
  const faqs = JSON.parse(await readFile(tables.faqs.file, "utf8"));
  const active = new Set(
    docs
      .filter((d) => d.active_revision && !d.deleted_at)
      .map((d) => d.active_revision),
  );
  await saveJson("seed/manifest.json", {
    format: 2,
    at: old.at,
    embeddingModel: old.embeddingModel,
    embeddingRevision: old.embeddingRevision,
    dimensions: 384,
    schema: {
      file: "seed/schema.json",
      sha256: sha(await readFile("seed/schema.json")),
    },
    tables,
    files,
    canonical,
    models,
    counts: {
      published: active.size,
      activeChunks: chunks.filter((c) => active.has(c.revision_id)).length,
      publishedFaqs: faqs.filter((f) => f.status === "published").length,
    },
  });
  const used = new Set(Object.values(files).map((f) => path.resolve(f.file)));
  for (const f of await readdir("seed/files"))
    if (!used.has(path.resolve("seed/files", f)))
      await rm(path.join("seed/files", f));
  const tableFiles = new Set(
    Object.values(tables).map((t) => path.basename(t.file)),
  );
  for (const name of await readdir("seed/database"))
    if (!tableFiles.has(name)) await rm(path.join("seed/database", name));
  // Linux containers may run with a different UID than the host owner.
  for (const file of ["seed/schema.json", "seed/manifest.json"])
    await chmod(file, 0o644);
  console.log(
    JSON.stringify({
      snapshot: old.at,
      tables: Object.keys(tables).length,
      files: Object.keys(files).length,
      modelFiles: models.length,
    }),
  );
} catch (e) {
  fail(e);
}

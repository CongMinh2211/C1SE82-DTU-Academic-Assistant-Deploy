import Database from "better-sqlite3";
import { mkdir, cp, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../BE/config";
const destination = path.resolve(
  process.argv[2] ||
    `./backups/${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
if (destination.startsWith(dataDir + path.sep) || destination === dataDir)
  throw new Error("Backup must be outside APP_DATA_DIR");
await mkdir(destination, { recursive: false, mode: 0o700 });
// Published pointers are captured first. Vectors are append-only, so their later snapshot
// contains all generations referenced by that SQL snapshot, even during new ingestion.
for (const filename of ["academic.sqlite", "vectors.sqlite"]) {
  const source = new Database(path.join(dataDir, filename), { readonly: true });
  await source.backup(path.join(destination, filename));
  source.close();
}
await cp(path.join(dataDir, "sources"), path.join(destination, "sources"), {
  recursive: true,
});
await cp(
  path.join(dataDir, "corpus-manifest.json"),
  path.join(destination, "corpus-manifest.json"),
);
await writeFile(
  path.join(destination, "backup-info.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      format: 1,
      embeddingModel: "Xenova/multilingual-e5-small",
      embeddingRevision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
      note: "Restore application secrets separately. Model cache can be downloaded again.",
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(JSON.stringify({ event: "backup_complete", destination }));

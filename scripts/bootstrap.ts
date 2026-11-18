import { getMigrations } from "better-auth/db/migration";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { getAuth } from "../BE/auth";
import { db, row, rows, audit, now } from "../BE/db";
import { dataDir, requiredEnv } from "../BE/config";
import { parseConsolidated } from "../BE/rag/parser";
import {
  saveRevision,
  runNextJob,
  publishRevision,
} from "../BE/knowledge";
const auth = getAuth();
const migrations = await getMigrations(auth.options);
await migrations.runMigrations();
let administrator = await row<{
  id: string;
  role?: string;
}>("SELECT id,role FROM user WHERE email=?", requiredEnv("ADMIN_EMAIL"));
if (administrator && administrator.role !== "admin")
  throw new Error(
    "Configured bootstrap email already belongs to a non-admin account. Choose a different ADMIN_EMAIL.",
  );
if (!administrator) {
  const created = await auth.api.signUpEmail({
    body: {
      email: requiredEnv("ADMIN_EMAIL"),
      password: requiredEnv("ADMIN_PASSWORD"),
      name: process.env.ADMIN_NAME || "Quản trị viên",
    },
  });
  administrator = { id: created.user.id };
  await db()
    .prepare("UPDATE user SET role='admin',emailVerified=1 WHERE id=?")
    .run(administrator.id);
  await audit(administrator.id, "system.admin_bootstrapped", administrator.id);
}
if (!process.argv.includes("--migrate-only")) {
  const sourceText = await readFile(
    process.env.RAG_SOURCE_PATH || "knowledge/originals/Tailieu_AI_Tong_hop.txt",
    "utf8",
  );
  const sourceHash = createHash("sha256").update(sourceText).digest("hex");
  const manifestPath = path.join(dataDir, "corpus-manifest.json");
  const previousManifest = await readFile(manifestPath, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => null);
  if (previousManifest && previousManifest.sha256 !== sourceHash)
    throw new Error(
      "Canonical source changed. Review and update document revisions explicitly before changing the import manifest.",
    );
  const sources = parseConsolidated(sourceText);
  for (const source of sources) {
    const existing = await row(
      "SELECT id FROM documents WHERE id=?",
      source.sourceId,
    );
    if (existing) continue;
    const original = await readFile(
      path.join(process.env.PDF_SOURCE_DIR || "knowledge/originals", source.filename),
    );
    // Import exactly the reviewed consolidation, retaining the original PDF for verification.
    await saveRevision(
      {
        initialId: source.sourceId,
        title: source.title,
        topic: source.topic,
        scope: source.scope,
        kind: "seed",
        filename: source.filename,
        mime: "application/pdf",
        bytes: original,
        pages: source.pages,
      },
      administrator.id,
    );
  }
  if (!previousManifest)
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          file: "Tailieu_AI_Tong_hop.txt",
          sha256: sourceHash,
          importedAt: now(),
          documents: sources.map((s) => ({
            id: s.sourceId,
            title: s.title,
            pages: s.pages.length,
            scope: s.scope,
          })),
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
  if (process.argv.includes("--index")) {
    while (await runNextJob()) {
      /* durable, retryable indexing */
    }
  }
  if (process.argv.includes("--publish-seed")) {
    for (const source of sources) {
      const d = await row<{
        active_revision: string | null;
        deleted_at: string | null;
      }>(
        "SELECT active_revision,deleted_at FROM documents WHERE id=?",
        source.sourceId,
      );
      if (
        d &&
        !d.deleted_at &&
        !d.active_revision &&
        !(await row(
          "SELECT id FROM revisions WHERE document_id=? AND status='ready'",
          source.sourceId,
        ))
      )
        throw new Error(`Initial corpus not fully indexed: ${source.sourceId}`);
    }
    for (const r of await rows<{
      id: string;
    }>(
      "SELECT r.id FROM revisions r JOIN documents d ON d.id=r.document_id WHERE d.source_kind='seed' AND r.status='ready' AND d.active_revision IS NULL",
    ))
      await publishRevision(r.id, administrator.id);
  }
}
console.log(
  JSON.stringify({
    event: "bootstrap_finished",
    documents: (
      await row<{
        n: number;
      }>("SELECT count(*) n FROM documents")
    )?.n,
    published: (
      await row<{
        n: number;
      }>("SELECT count(*) n FROM documents WHERE active_revision IS NOT NULL")
    )?.n,
  }),
);

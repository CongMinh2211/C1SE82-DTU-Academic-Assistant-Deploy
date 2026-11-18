import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Pass before or after");
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const routeEntries = [];
for (const file of await files(".next/server/app")) {
  if (!file.endsWith("page_client-reference-manifest.js")) continue;
  const context = {};
  vm.runInNewContext(await readFile(file, "utf8"), context, { timeout: 1000 });
  for (const [route, value] of Object.entries(context.__RSC_MANIFEST)) {
    const chunks = [
      ...new Set(
        Object.values(value.clientModules)
          .flatMap((m) => m.chunks)
          .filter((c) => c.endsWith(".js")),
      ),
    ];
    const measured = await Promise.all(
      chunks.map(async (url) => {
        const bytes = await readFile(url.replace("/_next/", ".next/"));
        return { url, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
      }),
    );
    routeEntries.push({
      route,
      referencedClientBytes: measured.reduce((n, c) => n + c.bytes, 0),
      referencedClientGzipBytes: measured.reduce((n, c) => n + c.gzipBytes, 0),
      chunks: measured,
    });
  }
}
const staticFiles = await files(".next/static");
const js = await Promise.all(
  staticFiles
    .filter((f) => f.endsWith(".js"))
    .map(async (f) => {
      const b = await readFile(f);
      return { bytes: b.length, gzip: gzipSync(b).length };
    }),
);
const report = {
  phase,
  at: new Date().toISOString(),
  metric:
    "Build client-reference graph (not a browser Core Web Vitals measurement)",
  totalJsBytes: js.reduce((n, x) => n + x.bytes, 0),
  totalJsGzipBytes: js.reduce((n, x) => n + x.gzip, 0),
  routes: routeEntries,
};
await writeFile(
  process.argv[3] || `test-results/refactor-${phase}-bundle.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    phase,
    totalJsBytes: report.totalJsBytes,
    routes: routeEntries.map(({ route, referencedClientGzipBytes }) => ({
      route,
      referencedClientGzipBytes,
    })),
  }),
);

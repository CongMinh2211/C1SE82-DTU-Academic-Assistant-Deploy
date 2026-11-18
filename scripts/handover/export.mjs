import path from "node:path";
import { mkdir } from "node:fs/promises";
import { root, environment, run, nodeArgs, fail } from "./common.mjs";
try {
  await mkdir(path.join(root, "backups"), { recursive: true });
  const dest = path.join(
    root,
    "backups",
    "handover-" + new Date().toISOString().replace(/[:.]/g, "-"),
  );
  const env = await environment("cloud");
  await run(process.execPath, [...nodeArgs("scripts/backup-cloud.ts"), dest], {
    env,
  });
  await run(process.execPath, ["scripts/handover/build-seed.mjs", dest]);
  console.log("Snapshot mới đã đóng gói; bản runtime hiện có được giữ nguyên.");
} catch (e) {
  fail(e);
}

import path from "node:path";
import { root, run, verifyBundle, fail } from "./common.mjs";
try {
  await verifyBundle();
  const dest = path.resolve(
    process.argv[2] ||
      path.join(root, "..", "dtu-academic-assistant-handover.tar.gz"),
  );
  if (dest.startsWith(root + path.sep))
    throw new Error("Đặt file bàn giao ngoài project");
  await run(
    "tar",
    [
      "--exclude=./node_modules",
      "--exclude=./.next",
      "--exclude=./data",
      "--exclude=./backups",
      "--exclude=./test-results",
      "--exclude=./.git",
      "--exclude=./.env.target.local",
      "--exclude=./tsconfig.tsbuildinfo",
      "--exclude=./.DS_Store",
      "-czf",
      dest,
      ".",
    ],
    { env: { ...process.env, COPYFILE_DISABLE: "1" } },
  );
  console.log("Đã đóng gói đầy đủ source, seed, model và .env: " + dest);
} catch (e) {
  fail(e);
}

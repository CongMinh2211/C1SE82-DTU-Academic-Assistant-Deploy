import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  root,
  environment,
  run,
  nodeArgs,
  requireValues,
  redact,
  fail,
} from "./common.mjs";
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex < 0 ? 3000 : Number(args[portIndex + 1]);
const dev = args.includes("--dev");
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
try {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Port phải từ 1024 đến 65535");
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`Port ${port} đang được sử dụng`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
  const env = await environment("local");
  env.NODE_ENV = dev ? "development" : "production";
  env.BETTER_AUTH_URL = `http://localhost:${port}`;
  env.HANDOVER_ORIGIN = env.BETTER_AUTH_URL;
  requireValues(env, ["SAVEGATE_API_KEY", "BETTER_AUTH_SECRET"]);
  await run(process.execPath, nodeArgs("scripts/handover/restore-local.mjs"), {
    env,
    onSpawn: (child) => children.push(child),
  });
  if (!dev)
    await run(process.execPath, ["node_modules/next/dist/bin/next", "build", "FE"], {
      env,
      onSpawn: (child) => children.push(child),
    });
  if (stopping) throw new Error("Đã dừng");
  for (const command of [
    nodeArgs("scripts/worker.ts"),
    nodeArgs("BE/server.ts"),
    [
      "node_modules/next/dist/bin/next",
      dev ? "dev" : "start",
      "FE",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
  ]) {
    const child = spawn(process.execPath, command, {
      cwd: root,
      env,
      stdio: "inherit",
    });
    children.push(child);
    child.on("error", (e) => {
      console.error(redact(e.message, env));
      stop(1);
    });
    child.on("exit", (code) => {
      if (!stopping) stop(code || 1);
    });
  }
  for (let i = 0; i < 240 && !stopping; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        console.log(
          `\nSẵn sàng: http://localhost:${port}\nTài khoản: config/accounts.json · Dừng: Ctrl+C\n`,
        );
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (i === 239) throw new Error("Ứng dụng chưa sẵn sàng; xem lỗi phía trên");
  }
} catch (e) {
  if (!stopping) {
    fail(e);
    stop(1);
  }
}

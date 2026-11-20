// Mục đích file: Điều phối khởi động cả Backend (cổng 8001) và Frontend Next.js trên Render trong một Web Service duy nhất.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 10000);
const bePort = Number(process.env.API_PORT || 8001);

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child && child.exitCode === null) {
      try { child.kill("SIGTERM"); } catch {}
    }
  }
  process.exit(code);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

async function main() {
  console.log(`[Render Orchestrator] Khởi động DTU Academic Assistant...`);
  console.log(`[Render Orchestrator] Cổng Public Render (PORT): ${port}`);
  console.log(`[Render Orchestrator] Cổng Backend nội bộ (API_PORT): ${bePort}`);

  // Đảm bảo thư mục dữ liệu tồn tại
  const dataDir = process.env.APP_DATA_DIR || path.join(root, "data");
  await mkdir(dataDir, { recursive: true }).catch(() => {});

  // Cấu hình URL cho Better Auth nếu Render cung cấp RENDER_EXTERNAL_URL
  if (!process.env.BETTER_AUTH_URL && process.env.RENDER_EXTERNAL_URL) {
    process.env.BETTER_AUTH_URL = process.env.RENDER_EXTERNAL_URL;
  }
  if (!process.env.BETTER_AUTH_URL) {
    process.env.BETTER_AUTH_URL = `http://localhost:${port}`;
  }
  console.log(`[Render Orchestrator] BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`);

  // 1. Khởi động Backend (BE/server.ts) ở cổng 8001
  const beEnv = {
    ...process.env,
    API_PORT: String(bePort),
    API_HOST: "127.0.0.1",
    NODE_ENV: "production",
  };

  console.log(`[Render Orchestrator] Đang chạy Backend (BE/server.ts) tại 127.0.0.1:${bePort}...`);
  const beProcess = spawn(process.execPath, ["--import", "tsx", path.join(root, "BE/server.ts")], {
    cwd: root,
    env: beEnv,
    stdio: "inherit",
  });
  children.push(beProcess);

  beProcess.on("exit", (code) => {
    if (!stopping) {
      console.error(`[Render Orchestrator] Backend dừng đột ngột với mã ${code}`);
      stop(code || 1);
    }
  });

  // 2. Chờ Backend sẵn sàng phản hồi (health check)
  console.log(`[Render Orchestrator] Đang chờ Backend khởi động...`);
  let beReady = false;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${bePort}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        beReady = true;
        console.log(`[Render Orchestrator] Backend đã sẵn sàng (HTTP 200)!`);
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!beReady) {
    console.warn(`[Render Orchestrator] Cảnh báo: Backend chưa phản hồi /api/health sau 30s, vẫn tiếp tục khởi động Frontend...`);
  }

  // 3. Khởi động Worker ngầm (xử lý hàng đợi tài liệu & dọn rác)
  try {
    const workerProcess = spawn(process.execPath, ["--import", "tsx", path.join(root, "scripts/worker.ts")], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    children.push(workerProcess);
    workerProcess.on("exit", (code) => {
      console.log(`[Render Orchestrator] Worker kết thúc với mã ${code}`);
    });
  } catch (err) {
    console.warn(`[Render Orchestrator] Không thể khởi động worker:`, err);
  }

  // 4. Khởi động Frontend Next.js ở cổng Render ($PORT)
  const feEnv = {
    ...process.env,
    BACKEND_INTERNAL_URL: `http://127.0.0.1:${bePort}`,
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    NODE_ENV: "production",
  };

  console.log(`[Render Orchestrator] Đang chạy Frontend Next.js tại 0.0.0.0:${port}...`);
  const nextBin = path.join(root, "node_modules/next/dist/bin/next");
  const feProcess = spawn(process.execPath, [nextBin, "start", "FE", "--hostname", "0.0.0.0", "--port", String(port)], {
    cwd: root,
    env: feEnv,
    stdio: "inherit",
  });
  children.push(feProcess);

  feProcess.on("exit", (code) => {
    console.log(`[Render Orchestrator] Frontend Next.js dừng với mã ${code}`);
    stop(code || 0);
  });
}

main().catch((err) => {
  console.error(`[Render Orchestrator] Lỗi nghiêm trọng:`, err);
  stop(1);
});

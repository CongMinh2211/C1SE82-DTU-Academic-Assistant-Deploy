import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const sha = (value) => createHash("sha256").update(value).digest("hex");
export const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );
export const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
export async function saveJson(p, value) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}
export async function fileEnv(file) {
  try {
    return parseEnv(await readFile(path.resolve(root, file), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}
export async function environment(mode = "local") {
  const local = await fileEnv(".env.local");
  const cloud = mode === "cloud" ? await fileEnv(".env.cloud.local") : {};
  const env = { ...process.env, ...local, ...cloud };
  delete env.VERCEL_OIDC_TOKEN;
  if (mode === "local") {
    Object.assign(env, {
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      SOURCE_STORAGE: "local",
      INDEXING_MODE: "local",
      VERCEL: "",
      VERCEL_URL: "",
      WEB_SEARCH_PROVIDER: "parallel_free",
      BETTER_AUTH_URL: "http://localhost:3000",
    });
    env.APP_DATA_DIR = path.resolve(
      process.env.HANDOVER_DATA_DIR ||
        process.env.APP_DATA_DIR ||
        path.join(root, "data"),
    );
    if (process.env.HANDOVER_ORIGIN)
      env.BETTER_AUTH_URL = process.env.HANDOVER_ORIGIN;
  } else {
    Object.assign(env, {
      SOURCE_STORAGE: "blob",
      INDEXING_MODE: "vercel_queue",
      WEB_SEARCH_PROVIDER: "parallel_free",
      APP_DATA_DIR: "/tmp/dtu-runtime",
      ONNXRUNTIME_NODE_INSTALL: "skip",
    });
    env.BETTER_AUTH_URL =
      cloud.BETTER_AUTH_URL || "https://dtu-academic-assistant.vercel.app";
  }
  env.RAG_SOURCE_PATH = path.join(
    root,
    "knowledge/originals/Tailieu_AI_Tong_hop.txt",
  );
  env.PDF_SOURCE_DIR = path.join(root, "knowledge/originals");
  return env;
}
export async function loadEnvironment(mode = "local") {
  const env = await environment(mode);
  Object.assign(process.env, env);
  return env;
}
export function requireValues(env, names) {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new Error("Thiếu cấu hình: " + missing.join(", "));
}
export async function manifest() {
  const p = path.join(root, "seed/manifest.json");
  const bytes = await readFile(p);
  return { ...JSON.parse(bytes), manifestHash: sha(bytes) };
}
export function safePath(relative) {
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep))
    throw new Error("Đường dẫn ngoài project");
  return full;
}
export async function verifyBundle({ models = true } = {}) {
  const m = await manifest();
  const entries = [
    m.schema,
    ...Object.values(m.tables),
    ...Object.values(m.files),
    ...m.canonical,
    ...(models ? m.models : []),
  ];
  const unique = new Map(entries.map((e) => [e.file, e]));
  for (const e of unique.values())
    if (sha(await readFile(safePath(e.file))) !== e.sha256)
      throw new Error("Hash không khớp: " + e.file);
  return m;
}
export function redact(message, env = process.env) {
  let s = String(message);
  for (const [k, v] of Object.entries(env))
    if (
      /SECRET|PASSWORD|TOKEN|DATABASE_URL|API_KEY|POSTGRES_URL/.test(k) &&
      v?.length >= 8
    )
      s = s.replaceAll(v, "[redacted]");
  return s;
}
export function fail(e) {
  console.error(redact(e.message || e));
  process.exitCode = 1;
}
export async function run(
  cmd,
  args,
  { env = process.env, capture = false, cwd = root, input, onSpawn } = {},
) {
  return new Promise((resolve, reject) => {
    let stdout = "",
      stderr = "";
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio:
        input !== undefined
          ? ["pipe", "pipe", "pipe"]
          : capture
            ? ["ignore", "pipe", "pipe"]
            : "inherit",
    });
    onSpawn?.(child);
    if (input !== undefined) child.stdin.end(input);
    child.stdout?.on("data", (b) => (stdout += b));
    child.stderr?.on("data", (b) => (stderr += b));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(
            new Error(
              redact(`${cmd} thất bại (${code}). ${stderr.slice(-3000)}`, env),
            ),
          ),
    );
  });
}
export const nodeArgs = (file) => ["--import", "tsx", path.join(root, file)];
export function deploymentUrl(output) {
  const value = JSON.parse(output);
  const candidate = (value.deployment || value).url;
  if (typeof candidate !== "string")
    throw new Error("CLI không trả URL deployment");
  const url = new URL(
    candidate.startsWith("https://") ? candidate : `https://${candidate}`,
  );
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".vercel.app") ||
    url.pathname !== "/"
  )
    throw new Error("URL deployment không hợp lệ");
  return url.origin;
}

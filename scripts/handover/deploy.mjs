import {
  root,
  environment,
  fileEnv,
  exists,
  readJson,
  saveJson,
  requireValues,
  run,
  nodeArgs,
  fail,
  deploymentUrl,
} from "./common.mjs";
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
try {
  const target = option("--target", "existing");
  if (!["existing", "new"].includes(target))
    throw new Error("--target existing hoặc new");
  let env = await environment("cloud");
  if (target === "existing") {
    const expected = await readJson(root + "/config/vercel-project.json");
    const current = (await exists(root + "/.vercel/project.json"))
      ? await readJson(root + "/.vercel/project.json")
      : null;
    if (current && current.projectId !== expected.projectId)
      throw new Error(
        "Folder đang link project khác; dùng folder mới để tránh deploy nhầm",
      );
    await saveJson(root + "/.vercel/project.json", expected);
  } else {
    const envFile = option("--env", ".env.target.local");
    const values = await fileEnv(envFile);
    requireValues(values, [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "BLOB_READ_WRITE_TOKEN",
      "BETTER_AUTH_URL",
    ]);
    const project = option("--project");
    if (!project)
      throw new Error(
        "Cloud mới cần --project TEN_PROJECT_MOI và --env .env.target.local (DB/Blob đích mới)",
      );
    await run("npx", [
      "--yes",
      "vercel@65.2.0",
      "link",
      "--project",
      project,
      "--yes",
    ]);
    const linked = await readJson(root + "/.vercel/project.json");
    const production = await readJson(root + "/config/vercel-project.json");
    if (linked.projectId === production.projectId)
      throw new Error("Chế độ new không được trỏ project production hiện tại");
    env = { ...env, ...values };
    await run(process.execPath, [
      ...nodeArgs("scripts/handover/restore-cloud.mjs"),
      "--env",
      envFile,
    ]);
  }
  requireValues(env, [
    "DATABASE_URL",
    "BLOB_READ_WRITE_TOKEN",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "SAVEGATE_API_KEY",
  ]);
  await run("npx", ["--yes", "vercel@65.2.0", "whoami"], { capture: true });
  const listed = JSON.parse(
    await run(
      "npx",
      ["--yes", "vercel@65.2.0", "env", "ls", "production", "--json"],
      { capture: true },
    ),
  );
  const items = Array.isArray(listed)
    ? listed
    : listed.envs || listed.environmentVariables || [];
  const keys = [
    "SAVEGATE_API_KEY",
    "SAVEGATE_BASE_URL",
    "SAVEGATE_MODEL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "DATABASE_URL",
    "BLOB_READ_WRITE_TOKEN",
    "SOURCE_STORAGE",
    "INDEXING_MODE",
    "WEB_SEARCH_PROVIDER",
    "APP_DATA_DIR",
    "ONNXRUNTIME_NODE_INSTALL",
  ];
  for (const key of keys) {
    if (!env[key]) continue;
    if (items.some((i) => i.key === key && i.configurationId)) {
      console.log("Giữ cấu hình integration: " + key);
      continue;
    }
    const secret = /SECRET|KEY|TOKEN|DATABASE_URL/.test(key);
    const exists = items.some((i) => i.key === key);
    const operation = exists
      ? ["env", "update", key, "--environment", "production", "--yes"]
      : ["env", "add", key, "production"];
    await run(
      "npx",
      [
        "--yes",
        "vercel@65.2.0",
        ...operation,
        "--type",
        secret ? "secret" : "config",
      ],
      { env, capture: true, input: env[key] },
    );
    console.log("Đã kiểm tra cấu hình " + key);
  }
  const url = deploymentUrl(
    await run(
      "npx",
      [
        "--yes",
        "vercel@65.2.0",
        "deploy",
        "--prod",
        "--skip-domain",
        "--yes",
        "--json",
      ],
      { capture: true },
    ),
  );
  console.log("Đang kiểm tra " + url);
  await saveJson(root + "/test-results/handover-deployment.json", {
    at: new Date().toISOString(),
    url,
    target,
    status: "staged",
  });
  await run(process.execPath, [
    "scripts/handover/verify.mjs",
    url,
    "--protected",
  ]);
  if (args.includes("--stage-only")) {
    console.log("Bản staged đạt kiểm tra: " + url);
  } else {
    await run("npx", ["--yes", "vercel@65.2.0", "promote", url, "--yes"]);
    await run(process.execPath, [
      "scripts/handover/verify.mjs",
      env.BETTER_AUTH_URL,
    ]);
    await saveJson(root + "/test-results/handover-deployment.json", {
      at: new Date().toISOString(),
      url,
      target,
      status: "promoted",
      production: env.BETTER_AUTH_URL,
    });
  }
} catch (e) {
  fail(e);
}

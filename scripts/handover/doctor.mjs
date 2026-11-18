import {
  root,
  environment,
  requireValues,
  verifyBundle,
  readJson,
  fail,
} from "./common.mjs";
try {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Cần Node.js 24 trở lên");
  const env = await environment("local");
  requireValues(env, ["SAVEGATE_API_KEY", "BETTER_AUTH_SECRET"]);
  const m = await verifyBundle();
  const a = await readJson(root + "/config/accounts.json");
  for (const role of ["admin", "student"])
    if (!a.local?.[role]?.email || !a.local?.[role]?.password)
      throw new Error("Thiếu tài khoản " + role);
  console.log(
    JSON.stringify(
      {
        ready: true,
        node: process.versions.node,
        snapshot: m.at,
        counts: m.counts,
        cloudConfigured: !!(await environment("cloud")).DATABASE_URL,
        credentials: "config/accounts.json",
        search: "parallel_free",
        requiresInternet: "AI và tìm kiếm web; embedding model đã có sẵn",
      },
      null,
      2,
    ),
  );
} catch (e) {
  fail(e);
}

import { readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env.local");
  console.log("Existing .env.local preserved.");
} catch {
  const template = await readFile(".env.example", "utf8");
  const password = randomBytes(24).toString("base64url");
  const configured = template
    .replace(
      /^BETTER_AUTH_SECRET=$/m,
      `BETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}`,
    )
    .replace(/^ADMIN_PASSWORD=$/m, `ADMIN_PASSWORD=${password}`);
  await writeFile(".env.local", configured, { mode: 0o600, flag: "wx" });
  await writeFile(
    "config/credentials/local.json",
    JSON.stringify({ email: "admin@academic.local", password }, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Private configuration created. Set SAVEGATE_API_KEY in .env.local before setup.",
  );
}
try {
  await access(".env.search.local");
} catch {
  await writeFile(
    ".env.search.local",
    `SEARXNG_SECRET=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Private search configuration created.");
}

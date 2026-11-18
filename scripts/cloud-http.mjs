import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm } from "node:fs/promises";
export const origin = process.argv[2];
if (
  !origin?.startsWith("https://") ||
  !new URL(origin).hostname.endsWith(".vercel.app")
)
  throw new Error("Pass a verified Vercel HTTPS deployment URL");

const execute = promisify(execFile);
const rawFetch = globalThis.fetch;
// Use the authenticated CLI for this exact protected deployment; never change protection settings.
if (process.env.VERCEL_TEST_CLI)
  globalThis.fetch = async (input, options = {}) => {
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (new URL(target).origin !== origin) return rawFetch(input, options);
    const stem = `.vercel/cloud-test-${randomUUID()}`,
      config = stem + ".cfg",
      bodyFile = stem + ".body";
    const escaped = (value) =>
      String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')
        .replaceAll("\r", "")
        .replaceAll("\n", "");
    const lines = [
      "silent",
      "show-error",
      "include",
      "max-time = 180",
      `request = "${escaped(options.method || "GET")}"`,
    ];
    for (const [key, value] of new Headers(options.headers))
      lines.push(`header = "${escaped(key + ": " + value)}"`);
    if (options.body) {
      await writeFile(bodyFile, options.body, { mode: 0o600 });
      lines.push(`data-binary = "@${escaped(process.cwd() + "/" + bodyFile)}"`);
    }
    await writeFile(config, lines.join("\n"), { mode: 0o600 });
    try {
      const { stdout } = await execute(
        process.execPath,
        [process.env.VERCEL_TEST_CLI, "curl", target, "--", "--config", config],
        { encoding: "buffer", maxBuffer: 35 * 1024 * 1024, timeout: 190000 },
      );
      let offset = stdout.indexOf(Buffer.from("HTTP/"));
      if (offset < 0) throw new Error("Vercel CLI did not return HTTP headers");
      let end = stdout.indexOf(Buffer.from("\r\n\r\n"), offset);
      let header = stdout.subarray(offset, end).toString();
      let status = Number(header.match(/^HTTP\/\S+\s+(\d+)/)?.[1]);
      while (status < 200) {
        offset = end + 4;
        end = stdout.indexOf(Buffer.from("\r\n\r\n"), offset);
        header = stdout.subarray(offset, end).toString();
        status = Number(header.match(/^HTTP\/\S+\s+(\d+)/)?.[1]);
      }
      const headers = new Headers();
      for (const line of header.split("\r\n").slice(1)) {
        const i = line.indexOf(":");
        if (i > 0) headers.append(line.slice(0, i), line.slice(i + 1).trim());
      }
      return new Response(
        [204, 304].includes(status) ? null : stdout.subarray(end + 4),
        { status, headers },
      );
    } finally {
      await rm(config, { force: true });
      await rm(bodyFile, { force: true });
    }
  };
export async function call(
  path,
  { cookie, method = "GET", body, originHeader = origin } = {},
) {
  const response = await fetch(origin + path, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: originHeader,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(170000),
  });
  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  const cookies = response.headers
    .getSetCookie()
    .filter((c) => !c.startsWith("__Secure-better-auth.session_data"))
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: response.status, payload, cookie: cookies, response };
}

import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./common.mjs";
export function httpClient(origin, { protectedDeployment = false } = {}) {
  const base = new URL(origin);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("URL cần HTTPS hoặc localhost");
  return async function call(route, { method = "GET", cookie, body } = {}) {
    const headers = {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    };
    let response;
    if (protectedDeployment) {
      if (base.protocol !== "https:" || !base.hostname.endsWith(".vercel.app"))
        throw new Error("Protected URL phải là Vercel HTTPS");
      const temp = await mkdtemp(path.join(tmpdir(), "dtu-http-"));
      const config = path.join(temp, "curl.cfg");
      const output = path.join(temp, "response");
      const escape = (v) =>
        String(v)
          .replaceAll("\\", "\\\\")
          .replaceAll('"', '\\"')
          .replaceAll("\r", "")
          .replaceAll("\n", "");
      const lines = [
        "silent",
        "show-error",
        "include",
        "max-time = 180",
        `request = "${method}"`,
        `output = "${escape(output)}"`,
        ...Object.entries(headers).map(
          ([k, v]) => `header = "${escape(k + ": " + v)}"`,
        ),
      ];
      if (body) {
        const f = path.join(temp, "body.json");
        await writeFile(f, JSON.stringify(body), { mode: 0o600 });
        lines.push(`data-binary = "@${escape(f)}"`);
      }
      await writeFile(config, lines.join("\n"), { mode: 0o600 });
      try {
        await run(
          "npx",
          [
            "--yes",
            "vercel@65.2.0",
            "curl",
            origin + route,
            "--",
            "--config",
            config,
          ],
          { capture: true },
        );
        const b = await readFile(output);
        let start = b.indexOf(Buffer.from("HTTP/")),
          end,
          status,
          raw;
        do {
          end = b.indexOf(Buffer.from("\r\n\r\n"), start);
          raw = b.subarray(start, end).toString();
          status = Number(raw.match(/^HTTP\/\S+\s+(\d+)/)?.[1]);
          if (status < 200) start = end + 4;
        } while (status < 200);
        const h = new Headers();
        for (const l of raw.split("\r\n").slice(1)) {
          const i = l.indexOf(":");
          if (i > 0) h.append(l.slice(0, i), l.slice(i + 1).trim());
        }
        response = new Response(
          [204, 304].includes(status) ? null : b.subarray(end + 4),
          { status, headers: h },
        );
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    } else
      response = await fetch(origin + route, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(180000),
      });
    const bytes = Buffer.from(await response.arrayBuffer());
    let payload = null;
    try {
      payload = JSON.parse(bytes.toString());
    } catch {}
    const cookies = response.headers
      .getSetCookie()
      .filter((c) => !c.startsWith("__Secure-better-auth.session_data"))
      .map((c) => c.split(";")[0])
      .join("; ");
    return {
      status: response.status,
      payload,
      cookie: cookies,
      bytes,
      headers: response.headers,
    };
  };
}

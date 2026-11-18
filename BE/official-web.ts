// Mục đích file: Kiểm tra URL và tải nội dung web có kiểm soát, hạn chế truy cập địa chỉ không an toàn.
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { HttpError } from "./http";
import { normalize } from "./rag/parser";
import { selectedPassages, webRelevance } from "./web-sources";

export function officialUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    !(
      url.hostname === "duytan.edu.vn" ||
      url.hostname.endsWith(".duytan.edu.vn")
    ) ||
    isIP(url.hostname)
  ) {
    throw new HttpError(
      400,
      "Chỉ nhận URL HTTPS từ duytan.edu.vn và các tên miền con chính thức.",
    );
  }
  url.hash = "";
  return url;
}
export function publicWebUrl(value: string) {
  const url = new URL(value);
  if (
    value.length > 2048 ||
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    !url.hostname.includes(".") ||
    /(?:^|\.)localhost$|\.(?:local|internal|test)$/i.test(url.hostname)
  )
    throw new HttpError(400, "Nguồn web phải là URL HTTPS công cộng.");
  url.hash = "";
  return url;
}
export function isUniversityUrl(value: string) {
  const host = new URL(value).hostname;
  return host === "duytan.edu.vn" || host.endsWith(".duytan.edu.vn");
}
export function publicAddress(ip: string) {
  if (ip.includes(":"))
    return /^(2|3)[0-9a-f]{0,3}:/i.test(ip) && !/^2001:db8:/i.test(ip);
  const [a, b] = ip.split(".").map(Number);
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || b === 2)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19 || b === 51)) &&
    !(a === 203 && b === 0)
  );
}
async function fetchPage(
  value: string,
  options: {
    method?: "GET" | "POST";
    body?: string;
    maxBytes?: number;
    signal?: AbortSignal;
    redirectAllowed?: (url: string) => boolean;
  } = {},
  redirect = 0,
  officialOnly = true,
): Promise<{ bytes: Buffer; mime: string; url: string }> {
  options.signal?.throwIfAborted();
  const url = officialOnly ? officialUrl(value) : publicWebUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new HttpError(400, "Địa chỉ nguồn không được phép.");
  const address = addresses.find((a) => a.family === 4) || addresses[0];
  const result = await new Promise<{
    bytes: Buffer;
    mime: string;
    location?: string;
    status: number;
  }>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: options.method || "GET",
        timeout: 15000,
        signal: options.signal,
        family: address.family,
        // Pin the DNS result to prevent a second lookup/rebinding during connection.
        lookup: (_host, _options, callback) =>
          callback(null, address.address, address.family),
        headers: {
          "User-Agent": "DTUAcademicAssistant/1.0 (official-source-retrieval)",
          Accept: "text/html,application/pdf,text/plain",
          ...(options.body
            ? {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(options.body).toString(),
              }
            : {}),
        },
      },
      (response) => {
        const parts: Buffer[] = [];
        let size = 0;
        response.on("data", (part) => {
          size += part.length;
          if (size > (options.maxBytes || 5 * 1024 * 1024))
            req.destroy(new Error("Source too large"));
          else parts.push(part);
        });
        response.on("end", () =>
          resolve({
            bytes: Buffer.concat(parts),
            mime: response.headers["content-type"] || "",
            location: response.headers.location,
            status: response.statusCode || 500,
          }),
        );
        response.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Source timeout")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
    if (redirect >= 3) throw new Error("Too many source redirects");
    const next = new URL(result.location, url).href;
    if (options.redirectAllowed && !options.redirectAllowed(next)) throw new Error("Redirect outside crawl scope");
    return fetchPage(
      next,
      { maxBytes: options.maxBytes, signal: options.signal, redirectAllowed: options.redirectAllowed },
      redirect + 1,
      officialOnly,
    );
  }
  if (result.status !== 200) throw new Error("Official source unavailable");
  return { bytes: result.bytes, mime: result.mime, url: url.href };
}
export function fetchOfficial(
  value: string,
  options: Parameters<typeof fetchPage>[1] = {},
) {
  return fetchPage(value, options);
}
export function fetchPublicPage(
  value: string,
  options: Parameters<typeof fetchPage>[1] = {},
) {
  return fetchPage(value, options, 0, false);
}
export function readableHtml(html: string) {
  const $ = load(html);
  const rawDate =
    $(
      'meta[property="article:published_time"],meta[name="date"],meta[itemprop="datePublished"]',
    )
      .first()
      .attr("content") || $("time[datetime]").first().attr("datetime");
  const publishedAt =
    rawDate &&
    /^\d{4}-\d{2}-\d{2}/.test(rawDate) &&
    Number.isFinite(Date.parse(rawDate))
      ? new Date(rawDate).toISOString()
      : undefined;
  $(
    "script,style,noscript,nav,header,footer,iframe,form,aside,.col_right_right,.col_left_page",
  ).remove();
  const content = $(
    "article,.news-detail,.detail_content,.content_detail,.news_content,.content-news,.col_center_page",
  ).first();
  const node = content.length
    ? content
    : $("main").length
      ? $("main")
      : $("body");
  node.find("p,div,li,h1,h2,h3,br,tr").after("\n");
  return {
    ...(publishedAt ? { publishedAt } : {}),
    title:
      $("meta[property='og:title']").attr("content")?.trim() ||
      $("title").text().trim() ||
      $("h1").first().text().trim(),
    text: node
      .text()
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim(),
  };
}
export type WebEvidence = {
  title: string;
  url: string;
  text: string;
  retrievedAt: string;
  official: boolean;
  publishedAt?: string;
  tier?: import("./web-sources").SourceTier;
  assessment?: string;
  discoveredBy?: "web_search" | "university_search" | "provided_link";
  page?: number;
  pageEnd?: number;
};
export async function searchOfficial(
  query: string,
  signal?: AbortSignal,
  searchQueries: string[] = [],
): Promise<WebEvidence[]> {
  // The university's own search endpoint; no third-party search key or snippets treated as evidence.
  const key = normalize(query);
  const searchTerm =
    key.includes("hoc phi") || key.includes("tuition")
      ? "học phí"
      : key.includes("tot nghiep") || key.includes("graduat")
        ? "tốt nghiệp"
        : key.includes("dang ky") || key.includes("enrol")
          ? "đăng ký học phần"
          : query;
  const links: string[] = [];
  const linkScores = new Map<string, number>();
  let searchAvailable = false;
  // A student can also supply a related public article directly. The page must
  // actually mention Duy Tan; a search snippet is never used as evidence.
  for (const value of query.match(/https:\/\/[^\s<>"']+/g) || []) {
    try {
      const href = publicWebUrl(value.replace(/[),.;]+$/, "")).href;
      links.push(href);
      linkScores.set(href, 10000);
    } catch {}
  }
  const webSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
    : AbortSignal.timeout(25000);
  for (const term of [
    ...new Set([...searchQueries.slice(0, 1), searchTerm]),
  ].slice(0, 2)) {
    try {
      const result = await fetchOfficial("https://duytan.edu.vn/Search", {
        method: "POST",
        signal: webSignal,
        body: new URLSearchParams({ skey: term.slice(0, 120) }).toString(),
      });
      const $ = load(result.bytes.toString("utf8"));
      searchAvailable = true;
      $("#searchresults a[href]").each((_i, el) => {
        try {
          const href = publicWebUrl(
            new URL($(el).attr("href")!, result.url).href,
          ).href;
          if (!links.includes(href)) links.push(href);
          linkScores.set(
            href,
            Math.max(
              linkScores.get(href) || 0,
              webRelevance($(el).text(), query),
            ),
          );
        } catch {}
      });
    } catch {
      signal?.throwIfAborted();
    }
  }
  if (!searchAvailable && !links.length)
    throw new Error("University search unavailable");
  const terms = normalize(query).match(/[a-z0-9]{3,}/g) || [];
  const fetched = await Promise.allSettled(
    links
      .sort((a, b) => (linkScores.get(b) || 0) - (linkScores.get(a) || 0))
      .slice(0, 4)
      .map(async (url): Promise<WebEvidence | null> => {
        try {
          const page = await fetchPage(url, { signal: webSignal }, 0, false);
          if (!page.mime.includes("text/html")) return null;
          const readable = readableHtml(page.bytes.toString("utf8"));
          const official = isUniversityUrl(page.url);
          if (
            !official &&
            !/\bduy tan\b|duytan\.edu\.vn/.test(
              normalize(`${readable.title}\n${readable.text}`),
            )
          )
            return null;
          const text = selectedPassages(readable.text, query);
          if (
            text.length > 100 &&
            terms.some((t) => normalize(text).includes(t))
          )
            return {
              title: readable.title,
              url: page.url,
              text,
              retrievedAt: new Date().toISOString(),
              official,
              publishedAt: readable.publishedAt,
              discoveredBy: query.includes(page.url)
                ? "provided_link"
                : "university_search",
            };
          return null;
        } catch {
          return null;
        }
      }),
  );
  signal?.throwIfAborted();
  return fetched.flatMap((r) =>
    r.status === "fulfilled" && r.value ? [r.value] : [],
  );
}

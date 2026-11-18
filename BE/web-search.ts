// Mục đích file: Điều phối tìm kiếm web và chọn các nguồn liên quan để hỗ trợ trả lời có trích dẫn.
import {
  fetchPublicPage,
  readableHtml,
  publicWebUrl,
  isUniversityUrl,
  searchOfficial,
  type WebEvidence,
} from "./official-web";
import {
  canonicalSearchUrl,
  relevantToUniversity,
  selectedPassages,
  sourceAssessment,
  webRelevance,
  requestedPublisherBoost,
} from "./web-sources";
import { normalize } from "./rag/parser";
import { parallelSearch, parallelSearchReady } from "./parallel-search";

export type SearchCandidate = {
  url: string;
  title: string;
  snippet: string;
  score: number;
};
export type WebSearchResult = {
  sources: WebEvidence[];
  coverage: "global" | "university_only";
  candidates: number;
  cacheHit: boolean;
};
const runtime = globalThis as unknown as {
  dtuWebCache?: Map<string, { at: number; result: WebSearchResult }>;
  dtuSearchState?: {
    status: "ready" | "degraded";
    at: string;
    candidates: number;
    sources: number;
  };
  dtuSearchHealth?: { at: number; available: boolean };
};

export async function webSearchState() {
  const freeCloud = process.env.WEB_SEARCH_PROVIDER === "parallel_free";
  const configured = freeCloud || !!process.env.WEB_SEARCH_URL;
  if (
    configured &&
    (!runtime.dtuSearchHealth ||
      Date.now() - runtime.dtuSearchHealth.at > 20000)
  ) {
    let available = false;
    try {
      if (freeCloud)
        available = await parallelSearchReady(AbortSignal.timeout(12000));
      else {
        const result = await fetch(
          new URL("/healthz", process.env.WEB_SEARCH_URL),
          { signal: AbortSignal.timeout(2000), cache: "no-store" },
        );
        available = result.ok;
      }
    } catch {}
    runtime.dtuSearchHealth = { at: Date.now(), available };
  }
  return {
    configured,
    available: configured && !!runtime.dtuSearchHealth?.available,
    checkedAt: runtime.dtuSearchHealth
      ? new Date(runtime.dtuSearchHealth.at).toISOString()
      : null,
    ...runtime.dtuSearchState,
  };
}
export function scopedSearchQuery(term: string) {
  const cleaned = term
    .replace(/\bsite:\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim()
    .slice(0, 220);
  if (/duy tan/.test(normalize(cleaned))) return cleaned;
  return `${cleaned} "Đại học Duy Tân"`;
}
export function chooseSearchCandidates(
  items: SearchCandidate[],
  limit = 5,
  query = "",
) {
  const unique = new Map<string, SearchCandidate>();
  for (const item of items) {
    try {
      const url = canonicalSearchUrl(publicWebUrl(item.url).href);
      if (!unique.has(url)) unique.set(url, { ...item, url });
    } catch {}
  }
  const ranked = [...unique.values()].sort(
    (a, b) =>
      sourceAssessment(b.url).priority +
      requestedPublisherBoost(b.url, query) +
      b.score -
      (sourceAssessment(a.url).priority +
        requestedPublisherBoost(a.url, query) +
        a.score),
  );
  const chosen: SearchCandidate[] = [];
  const hosts = new Map<string, number>();
  const add = (item: SearchCandidate) => {
    const host = new URL(item.url).hostname;
    if (
      chosen.length >= limit ||
      chosen.some((c) => c.url === item.url) ||
      (hosts.get(host) || 0) >= 2
    )
      return;
    chosen.push(item);
    hosts.set(host, (hosts.get(host) || 0) + 1);
  };
  // Preserve external discovery instead of letting a university's subdomains
  // consume every slot. Authority is considered again after reading each page.
  for (const candidate of ranked.filter((c) => !isUniversityUrl(c.url))) {
    if (chosen.length >= Math.min(3, limit)) break;
    if (!hosts.has(new URL(candidate.url).hostname)) add(candidate);
  }
  ranked.forEach(add);
  return chosen;
}
async function discoverGlobal(
  term: string,
  signal: AbortSignal,
): Promise<SearchCandidate[]> {
  if (process.env.WEB_SEARCH_PROVIDER === "parallel_free")
    return parallelSearch(scopedSearchQuery(term), signal);
  const configured = process.env.WEB_SEARCH_URL;
  if (!configured) throw new Error("Global search not configured");
  const endpoint = new URL("/search", configured);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password
  )
    throw new Error("Invalid search service");
  endpoint.search = new URLSearchParams({
    q: scopedSearchQuery(term),
    format: "json",
    categories: "general",
    language: "all",
    safesearch: "1",
  }).toString();
  // This operator-configured private service is separate from untrusted source
  // URLs. All result URLs go through public DNS/IP validation before fetching.
  const response = await fetch(endpoint, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json", "X-Real-IP": "127.0.0.1" },
  });
  if (!response.ok) throw new Error("Global search unavailable");
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error("Search response too large");
  const result = JSON.parse(raw) as {
    results?: {
      url: string;
      title?: string;
      content?: string;
      score?: number;
    }[];
    unresponsive_engines?: unknown[];
  };
  if (!Array.isArray(result.results))
    throw new Error("Invalid search response");
  if (!result.results.length && (result.unresponsive_engines?.length || 0) >= 5)
    throw new Error("Search engines unavailable");
  return result.results
    .slice(0, 24)
    .filter((r) => typeof r.url === "string")
    .map((r, i) => ({
      url: r.url,
      title: r.title || "",
      snippet: r.content || "",
      score: Math.max(0, 24 - i),
    }));
}
async function readCandidate(
  candidate: SearchCandidate,
  query: string,
  signal: AbortSignal,
): Promise<WebEvidence | null> {
  try {
    const page = await fetchPublicPage(candidate.url, {
      signal,
      maxBytes: 5 * 1024 * 1024,
    });
    const assessment = sourceAssessment(page.url);
    let title = new URL(page.url).hostname,
      text = "",
      publishedAt: string | undefined,
      sourcePage = 1;
    if (page.mime.includes("text/html")) {
      const readable = readableHtml(page.bytes.toString("utf8"));
      title = readable.title || title;
      if (!relevantToUniversity(title, readable.text, page.url)) return null;
      text = selectedPassages(readable.text, query);
      publishedAt = readable.publishedAt;
    } else if (page.mime.includes("application/pdf")) {
      const { pdfParser } = await import("./pdf");
      const parser = await pdfParser(new Uint8Array(page.bytes));
      try {
        const parsed = await parser.getText();
        if (parsed.total > 80) return null;
        const terms = normalize(query).match(/[a-z0-9]{3,}/g) || [];
        const ranked = parsed.pages
          .map((p) => ({
            ...p,
            score: terms.filter((t) => normalize(p.text).includes(t)).length,
          }))
          .sort((a, b) => b.score - a.score);
        const chosen = ranked[0];
        if (
          !chosen ||
          !relevantToUniversity(
            title,
            parsed.pages.map((p) => p.text).join("\n"),
            page.url,
          )
        )
          return null;
        title =
          parsed.pages[0]?.text
            .split("\n")
            .find((line) => line.trim().length > 5)
            ?.trim()
            .slice(0, 180) || title;
        sourcePage = chosen.num;
        text =
          chosen.text.length <= 14000
            ? chosen.text
            : selectedPassages(chosen.text, query);
      } finally {
        await parser.destroy();
      }
    }
    if (text.trim().length < 120) return null;
    return {
      title,
      url: page.url,
      text,
      retrievedAt: new Date().toISOString(),
      publishedAt,
      official: assessment.tier === "official",
      tier: assessment.tier,
      assessment: assessment.reason,
      discoveredBy: "web_search",
      page: sourcePage,
      pageEnd: sourcePage,
    };
  } catch {
    return null;
  }
}
export async function searchUniversityWeb(
  query: string,
  signal?: AbortSignal,
  searchTerms: string[] = [],
): Promise<WebSearchResult> {
  signal?.throwIfAborted();
  runtime.dtuWebCache ||= new Map();
  const key = normalize(JSON.stringify([query, searchTerms]));
  const cached = runtime.dtuWebCache.get(key);
  if (cached && Date.now() - cached.at < 120000)
    return { ...cached.result, cacheHit: true };
  const webSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(32000)])
    : AbortSignal.timeout(32000);
  const terms = [...new Set(searchTerms.length ? searchTerms : [query])].slice(
    0,
    2,
  );
  const discovery = Promise.allSettled(
    terms.map((term) => discoverGlobal(term, webSignal)),
  );
  const native = searchOfficial(query, webSignal, searchTerms);
  const reading = discovery.then(async (results) => {
    const candidates = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    const pages = await Promise.allSettled(
      chooseSearchCandidates(candidates, 5, query).map((c) =>
        readCandidate(c, query, webSignal),
      ),
    );
    return { results, candidates, pages };
  });
  const [{ results: globalResults, candidates, pages }, university] =
    await Promise.all([reading, native.catch(() => [] as WebEvidence[])]);
  const globalAvailable = globalResults.some((r) => r.status === "fulfilled");
  signal?.throwIfAborted();
  const all = [
    ...pages.flatMap((r) =>
      r.status === "fulfilled" && r.value ? [r.value] : [],
    ),
    ...university.map((s) => {
      const assessment = sourceAssessment(s.url);
      return { ...s, tier: assessment.tier, assessment: assessment.reason };
    }),
  ];
  const selected = selectWebSources(all, query);
  const result: WebSearchResult = {
    sources: selected,
    coverage: globalAvailable ? "global" : "university_only",
    candidates: candidates.length,
    cacheHit: false,
  };
  runtime.dtuSearchState = {
    status: globalAvailable ? "ready" : "degraded",
    at: new Date().toISOString(),
    candidates: candidates.length,
    sources: selected.length,
  };
  if (!globalAvailable && !selected.length)
    throw new Error("Web search unavailable");
  if (runtime.dtuWebCache.size >= 50)
    runtime.dtuWebCache.delete(runtime.dtuWebCache.keys().next().value!);
  if (selected.length && globalAvailable)
    runtime.dtuWebCache.set(key, { at: Date.now(), result });
  return result;
}
export function selectWebSources(all: WebEvidence[], query: string) {
  const seen = new Set<string>(),
    texts = new Set<string>();
  const score = (s: WebEvidence) =>
    sourceAssessment(s.url).priority +
    requestedPublisherBoost(s.url, query) +
    webRelevance(s.title, query) * 2 +
    webRelevance(s.text, query);
  const sources = all
    .filter((s) => {
      const id = canonicalSearchUrl(s.url);
      const body = normalize(s.text).replace(/\s+/g, " ");
      if (
        seen.has(id) ||
        texts.has(body) ||
        !relevantToUniversity(s.title, s.text, s.url)
      )
        return false;
      seen.add(id);
      texts.add(body);
      return true;
    })
    .sort((a, b) => score(b) - score(a));
  return [
    ...sources.filter((s) => !s.official).slice(0, 3),
    ...sources.filter((s) => s.official).slice(0, 3),
  ];
}

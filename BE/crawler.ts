import { createHash } from "node:crypto";
import { load } from "cheerio";
import { db, row, audit } from "./db";
import { fetchOfficial, officialUrl, readableHtml } from "./official-web";
import { saveRevision } from "./knowledge";

export type CrawlSchedule = {id:string; start_url:string; topic:string; scope:string; interval_hours:number; max_pages:number; created_by:string};

// Dùng nhóm riêng của bot nếu có, nếu không dùng nhóm chung; luật dài nhất được ưu tiên.
export function robotsAllowed(content: string, target: URL): boolean {
  const groups: {agents:string[]; rules:{allow:boolean; path:string}[]}[] = [];
  let group: typeof groups[number] | undefined;
  let hasRule = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase(), value = match[2].trim();
    if (key === "user-agent") {
      if (!group || hasRule) { group = {agents:[],rules:[]}; groups.push(group); hasRule = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === "allow" || key === "disallow")) {
      hasRule = true;
      if (value) group.rules.push({allow:key === "allow",path:value});
    }
  }
  const specific = groups.filter(g => g.agents.some(a => a !== "*" && "dtuacademicassistant".includes(a)));
  const selected = specific.length ? specific : groups.filter(g => g.agents.includes("*"));
  const path = target.pathname + target.search;
  const rules = selected.flatMap(g => g.rules).filter(r => {
    const anchored = r.path.endsWith("$");
    const pathPattern = anchored ? r.path.slice(0, -1) : r.path;
    const pattern = pathPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + (anchored ? "$" : "");
    try { return new RegExp(`^${pattern}`).test(path); } catch { return false; }
  }).sort((a,b) => b.path.length-a.path.length || Number(b.allow)-Number(a.allow));
  return rules[0]?.allow ?? true;
}

// Chỉ đi theo liên kết cùng origin của website DTU đã cấu hình, không theo đăng nhập hay mạng xã hội.
export function crawlLinks(html:string, base:string): string[] {
  const $ = load(html), origin = new URL(base).origin, links = new Set<string>();
  $("a[href]").each((_, a) => {
    try {
      const url = officialUrl(new URL($(a).attr("href")!, base).href);
      if (url.origin !== origin || /\.(?:jpg|jpeg|png|zip|rar|mp4|css|js)$/i.test(url.pathname) || /(?:login|logout|signin|dang-nhap)/i.test(url.pathname)) return;
      links.add(url.href);
    } catch { /* Bỏ liên kết ngoài phạm vi. */ }
  });
  return [...links];
}

export async function crawlOnce(schedule:CrawlSchedule, fetcher = fetchOfficial) {
  const start = officialUrl(schedule.start_url), origin = start.origin;
  // Không đi tiếp khi không kiểm tra được robots.txt; tránh thu thập ngoài ý muốn.
  const robots = await fetcher(`${origin}/robots.txt`, {maxBytes:128000});
  if (new URL(robots.url).origin !== origin || !/text\/(?:plain|html)/i.test(robots.mime)) throw new Error("Không thể kiểm tra robots.txt của website.");
  const robotsText = robots.bytes.toString("utf8");
  if (/^\s*</.test(robotsText)) throw new Error("robots.txt không hợp lệ.");
  const queue = [start.href], seen = new Set<string>();
  let added = 0, unchanged = 0, failed = 0;
  while (queue.length && seen.size < Math.min(10, schedule.max_pages)) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    if (!robotsAllowed(robotsText, new URL(url))) continue;
    // Giãn các lượt tải để không gửi dồn yêu cầu lên website nhà trường.
    if (seen.size > 1 && fetcher === fetchOfficial) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const page = await fetcher(url, {maxBytes:5*1024*1024, redirectAllowed:(value) => {
        try { const target = officialUrl(value); return target.origin === origin && robotsAllowed(robotsText,target); } catch { return false; }
      }});
      if (new URL(page.url).origin !== origin || !robotsAllowed(robotsText, new URL(page.url))) { failed++; continue; }
      if (!/text\/html|application\/pdf|text\/plain/i.test(page.mime)) continue;
      const html = /text\/html/i.test(page.mime);
      const extracted = html ? readableHtml(page.bytes.toString("utf8")) : null;
      if (html) for (const link of crawlLinks(page.bytes.toString("utf8"),page.url)) if (!seen.has(link) && queue.length < 50) queue.push(link);
      if (html && (!extracted?.text || extracted.text.length < 100)) continue;
      const mime = html ? "text/html" : /application\/pdf/i.test(page.mime) ? "application/pdf" : "text/plain";
      const existing = await row<{id:string}>("SELECT id FROM documents WHERE source_url=? AND deleted_at IS NULL",page.url);
      const digest = createHash("sha256").update(page.bytes).digest("hex");
      if (existing && await row("SELECT id FROM revisions WHERE document_id=? AND sha256=? AND status NOT IN ('failed','superseded')",existing.id,digest)) { unchanged++; continue; }
      await saveRevision({documentId:existing?.id,title:(extracted?.title || new URL(page.url).pathname.split("/").pop() || "Nguồn DTU").slice(0,250).padEnd(5," "),topic:schedule.topic,scope:schedule.scope,kind:"url",url:page.url,filename:new URL(page.url).pathname.split("/").pop() || "source",mime,bytes:page.bytes},schedule.created_by);
      added++;
    } catch { failed++; }
  }
  return {visited:seen.size, added, unchanged, failed};
}

export async function runScheduledCrawl() {
  const time = Date.now();
  const schedule = await row<CrawlSchedule>("SELECT id,start_url,topic,scope,interval_hours,max_pages,created_by FROM crawl_schedules WHERE enabled=1 AND next_run<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY next_run LIMIT 1",time,time);
  if (!schedule) return false;
  const claim = await db().prepare("UPDATE crawl_schedules SET lease_until=? WHERE id=? AND enabled=1 AND (lease_until IS NULL OR lease_until<?)").run(time+900000,schedule.id,time);
  if (!claim.changes) return false;
  let status = "done", message = "";
  try { const result = await crawlOnce(schedule); message = `Đã xét ${result.visited} trang; ${result.added} bản mới chờ xử lý; ${result.unchanged} không đổi; ${result.failed} lỗi.`; if (result.failed) status = "partial"; }
  catch { status = "failed"; message = "Không thể thu thập hoặc kiểm tra robots.txt; vui lòng kiểm tra nguồn và thử lại."; }
  await db().prepare("UPDATE crawl_schedules SET last_run=?,last_status=?,last_message=?,next_run=?,lease_until=NULL WHERE id=?").run(Date.now(),status,message,Date.now()+schedule.interval_hours*3600000,schedule.id);
  await audit(schedule.created_by,"crawl.completed",schedule.id,{status,message});
  return true;
}

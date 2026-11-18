import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = await mkdtemp(path.join(tmpdir(),"dtu-crawler-"));
process.env.APP_DATA_DIR = dir;
delete process.env.DATABASE_URL;
const { robotsAllowed, crawlLinks, crawlOnce } = await import("../crawler");
const { db, rows } = await import("../db");

test("robots cho phép và từ chối theo luật dài nhất", () => {
  const rules = "User-agent: *\nDisallow: /private\nAllow: /private/public\n";
  assert.equal(robotsAllowed(rules,new URL("https://is.duytan.edu.vn/private/a")),false);
  assert.equal(robotsAllowed(rules,new URL("https://is.duytan.edu.vn/private/public/a")),true);
  const exact = "User-agent: *\nDisallow: /private$";
  assert.equal(robotsAllowed(exact,new URL("https://is.duytan.edu.vn/private")),false);
  assert.equal(robotsAllowed(exact,new URL("https://is.duytan.edu.vn/private-open")),true);
});
test("chỉ đi theo liên kết DTU cùng origin", () => {
  assert.deepEqual(crawlLinks('<a href="/news">a</a><a href="https://duytan.edu.vn/out">b</a><a href="https://evil.test/">c</a>',"https://is.duytan.edu.vn/"),["https://is.duytan.edu.vn/news"]);
});
test("nhiều trang được lưu chờ duyệt; chạy lại không nhân bản", async () => {
  const base="https://is.duytan.edu.vn/";
  const fetcher = async (url:string) => ({url, mime:url.endsWith("robots.txt") ? "text/plain" : "text/html", bytes:Buffer.from(url.endsWith("robots.txt") ? "User-agent: *\nDisallow: /private" : `<title>Tin học vụ DTU</title><main>${"Nội dung công khai để kiểm tra nguồn DTU. ".repeat(5)}<a href="/other">khác</a><a href="/private">riêng</a></main>`) });
  const config={id:"schedule",start_url:base,topic:"Học vụ",scope:"Sinh viên DTU theo thông báo",interval_hours:24,max_pages:5,created_by:"admin"};
  const first=await crawlOnce(config,fetcher);
  assert.equal(first.added,2);
  const again=await crawlOnce(config,fetcher);
  assert.equal(again.added,0);
  assert.equal(again.unchanged,2);
  const revisions=await rows<{status:string}>("SELECT status FROM revisions");
  assert.ok(revisions.every(r=>r.status!=="published"));
});
test.after(async()=>{await db().close();await rm(dir,{recursive:true,force:true});});

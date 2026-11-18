// Mục đích file: Kiểm thử: Các phép thống kê và trạng thái dashboard sau khi tách mã.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  dashboardCounters,
  type DashboardCounts,
} from "../../BE/queries/admin-stats";
import { postgresSql } from "../../BE/async-db";

// Thống kê phải phản ánh các trạng thái câu hỏi và tài liệu đúng dữ liệu.
test("one counter query preserves cited answers, drafts, archived sources and all question statuses", async () => {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE user(id TEXT);
    CREATE TABLE documents(id TEXT,deleted_at TEXT,active_revision TEXT);
    CREATE TABLE revisions(id TEXT,document_id TEXT,status TEXT,version INTEGER);
    CREATE TABLE traces(id TEXT,status TEXT);
    CREATE TABLE messages(trace_id TEXT,role TEXT,citations_json TEXT);
    CREATE TABLE feedback(status TEXT);
    CREATE TABLE chunks(revision_id TEXT);
    INSERT INTO user VALUES ('student'),('admin');
    INSERT INTO documents VALUES ('d1',NULL,'r1'),('d2','archived','r2'),('d3',NULL,NULL),('d4',NULL,'r4');
    INSERT INTO revisions VALUES ('r1','d1','published',1),('r2','d2','ready',1),('r3','d3','ready',1),('r4','d4','published',1),('r5','d4','ready',2);
    INSERT INTO traces VALUES ('t1','answered'),('t2','answered'),('t3','insufficient'),('t4','clarification'),('t5','error'),('t6','conversation');
    INSERT INTO messages VALUES ('t1','assistant','[{"id":"1"}]'),('t2','assistant','[]'),('t3','user','[{"id":"1"}]');
    INSERT INTO feedback VALUES ('pending'),('resolved'),('pending');
    INSERT INTO chunks VALUES ('r1'),('r1'),('r2'),('r3'),('r4'),('r5');
  `);
  let calls = 0;
  let sql = "";
  const counts = await dashboardCounters(async (query: string) => {
    calls++;
    sql = query;
    return database.prepare(query).get() as DashboardCounts;
  });
  assert.equal(calls, 1);
  assert.deepEqual(counts, {
    users: 2,
    documents: 3,
    published: 2,
    questions: 6,
    answered: 1,
    insufficient: 1,
    pendingDocuments: 2,
    unanswered: 3,
    feedback: 2,
    chunks: 3,
  });
  const postgres = postgresSql(sql);
  assert.match(postgres, /FROM "user"/);
  assert.match(postgres, /AS "pendingDocuments"/);
  assert.ok(!postgres.includes("_ordinal"));
  database.close();
});

// Chỉ dùng một lần để chuyển bản snapshot đã kiểm tra vào database demo trống.
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import { PgVector } from '@mastra/pg';
import { getMigrations } from 'better-auth/db/migration';
import { getAuth } from '../BE/auth';
import { postgresConnectionUrl } from '../BE/postgres-connection';
import { get, put } from '@vercel/blob';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

if (process.env.IMPORT_DEMO_SNAPSHOT !== 'yes') throw new Error('Import chưa được bật');
const local = process.env.IMPORT_LOCAL_TEST === 'yes';
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error('Thiếu DATABASE_URL');
if (local && !['localhost','127.0.0.1'].includes(new URL(rawUrl).hostname)) throw new Error('Test chỉ chạy trên localhost');
if (!local && process.env.RENDER_POSTGRES_INTERNAL !== 'true') throw new Error('Chỉ import vào Render nội bộ đã cấu hình');
const connectionString = local ? rawUrl : postgresConnectionUrl(rawUrl);
const base = process.env.IMPORT_SNAPSHOT_DIR || '/tmp/dtu-import';
await mkdir(base, {recursive:true, mode:0o700});
const archive = path.join(base, 'snapshot.tar.gz');
if (!local) {
  const blob = await get('migration/snapshot-demo.tar.gz', {access:'private',useCache:false});
  if (!blob || blob.statusCode !== 200) throw new Error('Không tìm thấy snapshot riêng tư');
  await pipeline(Readable.fromWeb(blob.stream as never), createWriteStream(archive,{mode:0o600}));
  const hash = createHash('sha256');
  for await (const b of createReadStream(archive)) hash.update(b);
  if (hash.digest('hex') !== '54106600f28a9c23a0134121cddddd37a4b22f06c11c8069c2f4524170ecd037') throw new Error('Checksum snapshot không khớp');
  execFileSync('tar',['-xzf',archive,'--no-same-owner','--no-same-permissions','-C',base]);
}
const db = new Database(path.join(base,'migration-academic.sqlite'),{readonly:true,fileMustExist:true});
const vectors = createClient({url:'file:'+path.join(base,'vectors.sqlite')});
const pool = new Pool({connectionString,max:2});
const quote = (s:string) => '"'+s.replaceAll('"','""')+'"';
const tables = ['user','account','documents','revisions','chunks','jobs','conversations','messages','feedback','faqs','audit','traces','user_language_preferences','user_notification_preferences'];
let vector: PgVector | undefined;
try {
  const marker = await pool.query("SELECT to_regclass('public.cloud_migrations') AS t");
  if (marker.rows[0].t) {
    const done=await pool.query("SELECT 1 FROM cloud_migrations WHERE id='demo-import-20261119'");
    if(done.rowCount) { console.log('Snapshot đã được nhập trước đó'); process.exit(0); }
  }
  for (const table of ['user','documents','messages','chunks']) {
    const exists=await pool.query('SELECT to_regclass($1) AS t',['public.'+quote(table)]);
    if(exists.rows[0].t && Number((await pool.query('SELECT count(*) AS n FROM '+quote(table))).rows[0].n)>0) throw new Error('Từ chối ghi đè dữ liệu hiện có: '+table);
  }
  if (db.pragma('integrity_check',{simple:true}) !== 'ok') throw new Error('Snapshot SQLite không toàn vẹn');
  await (await getMigrations({...getAuth().options,database:pool})).runMigrations();
  for (const file of ['001_cloud.sql','002_shared_conversations.sql','002_user_language_preferences.sql','003_revision_validity.sql','004_crawl_schedules.sql','005_feedback_notifications.sql']) await pool.query(await readFile('migrations/'+file,'utf8'));
  vector = new PgVector({id:'demo-import',connectionString,max:1});
  await vector.createIndex({indexName:'academic_e5_v1',dimension:384,metric:'cosine'});
  const sourceFiles=await readdir(path.join(base,'sources'));
  if(sourceFiles.length!==29) throw new Error('Thiếu file nguồn');
  if(!local) for(const name of sourceFiles) {
    if(!/^[a-zA-Z0-9._-]+\.(pdf|txt|html|docx|md)$/.test(name)) throw new Error('Tên file nguồn không hợp lệ');
    const key='sources/'+name;
    const old=await get(key,{access:'private',useCache:false});
    const bytes=await readFile(path.join(base,'sources',name));
    if(old && old.statusCode===200) {
      const previous=Buffer.from(await new Response(old.stream).arrayBuffer());
      if(!previous.equals(bytes)) throw new Error('File nguồn đích đã tồn tại nhưng khác nội dung');
    } else await put(key,bytes,{access:'private',addRandomSuffix:false,allowOverwrite:false});
  }
  const cols=(await pool.query("SELECT table_name,column_name,data_type,is_generated,is_identity FROM information_schema.columns WHERE table_schema='public'")).rows;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const table of tables) {
      if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
      const records=db.prepare('SELECT * FROM '+quote(table)).all() as Record<string,unknown>[];
      const meta=cols.filter(c=>c.table_name===table && c.is_generated==='NEVER' && c.is_identity==='NO');
      for(const record of records) {
        const selected=meta.filter(c=>Object.hasOwn(record,c.column_name));
        const values=selected.map(c=>c.data_type==='boolean' && record[c.column_name]!=null ? Boolean(record[c.column_name]) : record[c.column_name]);
        await client.query('INSERT INTO '+quote(table)+' ('+selected.map(c=>quote(c.column_name)).join(',')+') VALUES ('+selected.map((_,i)=>'$'+(i+1)).join(',')+')',values);
      }
      const actual=Number((await client.query('SELECT count(*) AS n FROM '+quote(table))).rows[0].n);
      if(actual!==records.length) throw new Error('Sai số lượng bảng '+table);
      console.log(table,actual);
    }
    await client.query('INSERT INTO chunks_fts(id,text) SELECT id,search_text FROM chunks');
    const result=await vectors.execute('SELECT vector_id, vector_extract(embedding) AS embedding, metadata FROM academic_e5_v1');
    if(result.rows.length!==2295) throw new Error('Thiếu vector');
    for(const row of result.rows) {
      const embedding=typeof row.embedding==='string' ? JSON.parse(row.embedding) : row.embedding;
      if(!Array.isArray(embedding) || embedding.length!==384) throw new Error('Vector sai kích thước');
      await client.query('INSERT INTO academic_e5_v1(vector_id,embedding,metadata,namespace) VALUES ($1,$2,$3,$4)',[row.vector_id,JSON.stringify(embedding),row.metadata,'default']);
    }
    const missing=await client.query('SELECT count(*)::int AS n FROM chunks c LEFT JOIN academic_e5_v1 v ON c.id=v.vector_id WHERE v.vector_id IS NULL');
    if(missing.rows[0].n) throw new Error('Có đoạn thiếu vector');
    await client.query("INSERT INTO cloud_migrations(id,detail_json,completed_at) VALUES ('demo-import-20261119',$1,$2)",[JSON.stringify({documents:26,vectors:2295,files:sourceFiles.length}),new Date().toISOString()]);
    await client.query('COMMIT');
    console.log('Import hoàn tất: 2295 vector, 29 file nguồn');
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
} finally { vectors.close(); db.close(); if(vector) await vector.disconnect(); await pool.end(); }

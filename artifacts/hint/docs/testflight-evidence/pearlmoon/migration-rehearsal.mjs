import pg from '/tmp/hint-pearlmoon-20260910/candidate/lib/db/node_modules/pg/lib/index.js';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile), dir='/tmp/hint-pearlmoon-20260910/migration-rehearsal';
const script='/tmp/hint-pearlmoon-20260910/candidate/lib/db/scripts/migrate.mjs';
const base='postgresql://hint_test:isolated-test-only@127.0.0.1:55439/';
const sourceName='hint_pearlmoon_backup_source',restoreName='hint_pearlmoon_backup_restore';
const admin=new pg.Client(base+'hint_quality'); await admin.connect();
const client=name=>new pg.Client(base+name);
let source,restored;
const migrate=async name=>(await exec(process.execPath,[script],{env:{...process.env,DATABASE_URL:base+name}})).stdout;
const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const snapshot=async conn=>{
 const names=(await conn.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 const tables={};for(const name of names)tables[name]=(await conn.query(`SELECT to_jsonb(t) AS row FROM public."${name}" t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row);
 return tables;
};
try {
 await admin.query(`CREATE DATABASE ${sourceName}`);await admin.query(`CREATE DATABASE ${restoreName}`);
 const initial=await migrate(sourceName), repeat=await migrate(sourceName);
 source=client(sourceName);await source.connect();
 await source.query("INSERT INTO profiles(anon_id,name,birth_date,birth_time,birth_place,latitude,longitude,timezone,timezone_offset) VALUES ('fictional-backup-owner','Fictional backup profile','1995-05-15','10:20','Chicago',41.87,-87.62,'America/Chicago',-5)");
 await source.query("INSERT INTO journal_entries(anon_id,title,body) VALUES ('fictional-backup-owner','Backup reflection','Entirely fictional rehearsal text')");
 await source.query("INSERT INTO compatibility_invites(owner_id,token,creator_input,expires_at) VALUES ('fictional-backup-owner','fictional-backup-token','{\"name\":\"Fictional creator\",\"birthDate\":\"1995-05-15\"}',now()+interval '7 days')");
 const saved=await snapshot(source);
 await writeFile(dir+'/fictional-app-data-backup.json',JSON.stringify(saved,null,2)+'\n');
 const replay=await migrate(restoreName);restored=client(restoreName);await restored.connect();
 await restored.query('BEGIN');
 for(const [name,rows] of Object.entries(saved)){
  await restored.query(`DELETE FROM public."${name}"`);
  if(rows.length)await restored.query(`INSERT INTO public."${name}" SELECT * FROM jsonb_populate_recordset(NULL::public."${name}",$1::jsonb)`,[JSON.stringify(rows)]);
 }
 await restored.query('COMMIT');
 const loaded=await snapshot(restored);assert.deepEqual(loaded,saved);
 const checked=await exec(process.execPath,[script,'--check'],{env:{...process.env,DATABASE_URL:base+restoreName}});
 assert.equal(saved.hint_schema_migrations.length,6);
 const report={passed:true,kind:'Application logical JSON backup plus exact versioned schema replay',isolation:'Two disposable databases on isolated local PostgreSQL 18; only fictional rows',scope:'Every public application table and migration ledger; cluster roles and operator pg_dump tooling are outside this rehearsal',tables:Object.fromEntries(Object.entries(saved).map(([k,v])=>[k,v.length])),sourceSHA256:hash(saved),restoredSHA256:hash(loaded),migrationLedgerCount:6,initial,repeat,replay,readiness:checked.stdout,cleanup:'Both rehearsal databases dropped in finally'};
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,tables:Object.keys(saved).length,sha256:hash(saved),migrations:6}));
}finally{
 await source?.end();await restored?.end();
 await admin.query(`DROP DATABASE IF EXISTS ${sourceName} WITH (FORCE)`);await admin.query(`DROP DATABASE IF EXISTS ${restoreName} WITH (FORCE)`);await admin.end();
}

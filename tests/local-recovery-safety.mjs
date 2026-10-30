import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {parseReport,countNames,integrityNames,tableNames}
  from '../scripts/collect-recovery-manifest.mjs';
import {requirePrivateRoot,verifySourceEnv,localDatabase,
  safePostgresEnv,assertLocalDatabaseStatus,assertCliVersion,
  resolveStorageObjectsRoot,inspectBackup,storageHashes}
  from '../scripts/local-recovery.mjs';

const counts=countNames.map((_,i)=>i===5?1:i+1).join('|');
const integrity1='0|0|0|0|0';
const integrityJson=['characters|6|0','templates|2|0','drafts|2|0','history|66|0'];
const roomIntegrity='0|0|0|0';
const report=[counts,integrity1,...integrityJson,roomIntegrity].join('\n');
const fp=tableNames.map(t=>t+'|1|'+'a'.repeat(64)).join('\n');
const manifest=parseReport(report,fp);
assert.equal(Object.keys(manifest.counts).length,11);
assert.equal(Object.keys(manifest.integrity).length,9);
assert.equal(Object.keys(manifest.fingerprints).length,8);
assert.equal(manifest.integrity.broken_room_roll_links,0);
assert.throws(()=>parseReport(report.replace('history|66|0','history|66|1'),fp),/Invalid JSON data/);
assert.throws(()=>parseReport(report,fp.replace('a'.repeat(64),'invalid')),/Incorrect database row fingerprint/);
assert.throws(()=>parseReport(report,fp.split('\n').slice(1).join('\n')),/Missing fingerprint/);

assert.throws(()=>requirePrivateRoot('relative/path'),/absolute private/);
assert.throws(()=>requirePrivateRoot(process.cwd()+'/local-backup'),/Git checkout/);
assert.equal(requirePrivateRoot(path.join(os.tmpdir(),'ays-private-recovery')),
  path.resolve(os.tmpdir(),'ays-private-recovery'));
const valid={
  AYS_SOURCE_PROJECT_REF:'cvimyqmksxeigjnofexf',
  PGHOST:'db.cvimyqmksxeigjnofexf.supabase.co',
  PGUSER:'postgres',PGPASSWORD:'synthetic-only',
};
assert.doesNotThrow(()=>verifySourceEnv(valid));
assert.throws(()=>verifySourceEnv({...valid,AYS_SOURCE_PROJECT_REF:'bdozzhlmuaswqeyawzdr'}),/Wrong remote/);
assert.throws(()=>verifySourceEnv({...valid,PGHOST:'127.0.0.1'}),/do not identify/);
assert.throws(()=>verifySourceEnv({...valid,PGPASSWORD:''}),/Missing PG/);
assert.equal(localDatabase.PGHOST,'127.0.0.1');
assert.equal(localDatabase.PGPORT,'54322');
assert.throws(()=>verifySourceEnv({...valid,PGHOSTADDR:'127.0.0.1'}),/PGHOSTADDR/);
assert.throws(()=>verifySourceEnv({...valid,PGSERVICE:'remote-service'}),/PGHOSTADDR/);
const sanitized=safePostgresEnv({
  PGHOSTADDR:'some-other-server',PGSERVICE:'foreign',PGPASSFILE:'/tmp/.pgpass',
  SUPABASE_ACCESS_TOKEN:'never-forward',PGHOST:'db.remote.supabase.co',
  PGOPTIONS:'-c malicious=true',
},localDatabase);
assert.equal(sanitized.PGHOST,'127.0.0.1');
assert.equal(sanitized.PGPORT,'54322');
assert.equal(sanitized.PGSSLMODE,'disable');
for(const key of ['PGHOSTADDR','PGSERVICE','PGPASSFILE','PGOPTIONS','SUPABASE_ACCESS_TOKEN'])
  assert.ok(!(key in sanitized),'Sensitive libpq override leaked: '+key);
assert.equal(assertCliVersion('2.122.0\n'),'2.122.0');
assert.throws(()=>assertCliVersion('2.99.0\n'),/Expected Supabase CLI 2.122.0/);
assert.doesNotThrow(()=>assertLocalDatabaseStatus(
  'API_URL=http://127.0.0.1:54321\nDB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres'));
assert.throws(()=>assertLocalDatabaseStatus(
  'DB_URL=postgresql://postgres:postgres@evil.example:54322/postgres'),/does not match/);
assert.throws(()=>assertLocalDatabaseStatus(
  'DB_URL=postgresql://postgres:postgres@127.0.0.1:54323/postgres'),/does not match/);

const t=await mkdtemp(path.join(os.tmpdir(),'ays-storage-layout-'));
try{
  const nested=path.join(t,'nested');
  await mkdir(path.join(nested,'character-portraits','owner'),{recursive:true});
  await writeFile(path.join(nested,'character-portraits','owner','1.webp'),'fixture');
  assert.equal(await resolveStorageObjectsRoot(nested,1),
    path.join(nested,'character-portraits'));
  const direct=path.join(t,'direct');
  await mkdir(path.join(direct,'owner'),{recursive:true});
  await writeFile(path.join(direct,'owner','1.webp'),'fixture');
  assert.equal(await resolveStorageObjectsRoot(direct,1),direct);
  await assert.rejects(resolveStorageObjectsRoot(direct,2),/incomplete object transfer/);
  await mkdir(path.join(t,'empty'));
  assert.equal(await resolveStorageObjectsRoot(path.join(t,'empty'),0),
    path.join(t,'empty'));
}finally{await rm(t,{recursive:true,force:true});}

// Full offline archive acceptance: a correct private archive passes before
// any Docker operation, while modified SQL or image bytes are rejected.
const privateFixture=await mkdtemp(path.join(os.tmpdir(),'ays-backup-acceptance-'));
try{
  await mkdir(path.join(privateFixture,'db'));
  await mkdir(path.join(privateFixture,'storage','character-portraits','owner'),{recursive:true});
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const sqlContents=Object.fromEntries(
    ['roles.sql','schema.sql','auth-data.sql','data.sql'].map(n=>[n,'fixture '+n]));
  for(const [name,content] of Object.entries(sqlContents))
    await writeFile(path.join(privateFixture,'db',name),content);
  const dbDigests=Object.fromEntries(
    Object.entries(sqlContents).map(([name,content])=>[name,hash(content)]));
  const storageLocation=path.join(privateFixture,'storage','character-portraits','owner','fixture.webp');
  await writeFile(storageLocation,'synthetic-pixel');
  await writeFile(path.join(privateFixture,'source.json'),JSON.stringify(manifest));
  await writeFile(path.join(privateFixture,'db-digests.json'),JSON.stringify(dbDigests));
  await writeFile(path.join(privateFixture,'storage-digests.json'),
    JSON.stringify({'owner/fixture.webp':hash('synthetic-pixel')}));
  assert.deepEqual((await inspectBackup(privateFixture)).source,manifest);
  const {main:operatorReport}=await import('../scripts/recovery-acceptance-report.mjs');
  const oldRoot=process.env.AYS_RECOVERY_ROOT;
  process.env.AYS_RECOVERY_ROOT=privateFixture;
  const emitted=[];
  const oldLog=console.log;
  try{
    console.log=(...args)=>emitted.push(args.join(' '));
    await operatorReport();
  }finally{
    console.log=oldLog;
    if(oldRoot===undefined)delete process.env.AYS_RECOVERY_ROOT;
    else process.env.AYS_RECOVERY_ROOT=oldRoot;
  }
  assert.ok(emitted.includes('BACKUP: PASS'));
  assert.ok(emitted.includes('RESTORE: NOT_RUN'));
  assert.ok(emitted.includes('LOCAL_TWO_JWT_E2E: NOT_RUN'));
  assert.ok(emitted.every(line=>!line.includes(privateFixture)),
    'Operator report must not disclose private backup paths');
  assert.deepEqual(await storageHashes(path.join(privateFixture,'storage','character-portraits')),
    {'owner/fixture.webp':hash('synthetic-pixel')});
  await writeFile(storageLocation,'tampered-pixel');
  await assert.rejects(inspectBackup(privateFixture),/Storage backup checksum mismatch/);
  await writeFile(storageLocation,'synthetic-pixel');
  await writeFile(path.join(privateFixture,'db','schema.sql'),'tampered-schema');
  await assert.rejects(inspectBackup(privateFixture),/Database backup checksum mismatch/);
}finally{await rm(privateFixture,{recursive:true,force:true});}

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const recovery=read('../scripts/local-recovery.mjs');
const collector=read('../scripts/collect-recovery-manifest.mjs');
const jwt=read('../scripts/local-jwt-e2e.mjs');
const e2e=read('../scripts/security-two-accounts-e2e.mjs');
const ignore=read('../.gitignore');
const storagePolicies=read('../supabase/proposals/local-restore-portrait-storage.sql');
const sourceGuard=read('../supabase/storage-source-guard.sql');
assert.match(sourceGuard,/READ-ONLY/);
assert.match(sourceGuard,/file_size_limit=450000/);
assert.match(sourceGuard,/allowed_mime_types=ARRAY\['image\/webp'\]/);
assert.match(sourceGuard,/Portrait upload own character/);
assert.match(recovery,/Remote portrait Storage policies drifted/);
assert.match(recovery,/Local private Storage policies differ/);
assert.match(recovery,/PGSSLMODE:env\.PGSSLMODE\?\?'require'/);
assert.match(storagePolicies,/character-portraits/);
assert.match(storagePolicies,/allowed_mime_types=ARRAY\['image\/webp'\]/);
assert.match(storagePolicies,/CREATE POLICY "Portrait read own character"/);
assert.match(storagePolicies,/CREATE POLICY "Portrait upload own character"/);
assert.match(storagePolicies,/storage\.foldername\(storage\.objects\.name\)/);
assert.match(storagePolicies,/\(card\|sheet\|source\)/);
assert.match(recovery,/local-restore-portrait-storage\.sql/);
assert.match(recovery,/const \{source\}=await inspectBackup\(root\)/);
assert.match(recovery,/restore NOT YET tested/);
assert.match(jwt,/contentType:'image\/webp'/);
assert.match(jwt,/-source\.webp/);
assert.match(jwt,/owner\.characterId/);
assert.match(recovery,/--linked','--role-only/);
assert.match(recovery,/--data-only','--use-copy/);
assert.match(recovery,/--data-only','--schema=auth/);
assert.match(recovery,/storage','cp','-r'/);
assert.match(recovery,/--local','--experimental/);
assert.match(recovery,/PGHOST:'127\.0\.0\.1'/);
assert.match(recovery,/local-only/);
assert.match(recovery,/compareBackupRestore\(source,restored/);
assert.ok(!recovery.includes("'db','push'")&&!recovery.includes("'db','reset'"));
assert.match(collector,/default_transaction_read_only=on/);
assert.match(jwt,/createUser\(/);
assert.match(jwt,/signInWithPassword\(/);
assert.match(jwt,/status','-o','env/);
assert.match(jwt,/AYS_E2E_ISOLATED_RESTORE:'YES'/);
assert.match(jwt,/collectInventory\(localEnv\)/);
assert.match(recovery,/assertLocalDatabaseStatus\(call\('supabase'/);
assert.match(recovery,/safePostgresEnv\(process.env,localDatabase\)/);
assert.match(e2e,/assert\.ok\(localHost&&localPort/);
assert.match(e2e,/!denyJoin\.ok\|\|denyJoin\.data===null/);
assert.match(ignore,/supabase\/\.temp\//);
console.log('PASS: private backup manifest, local Docker guard and two-JWT safety checks');

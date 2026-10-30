import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReport,countNames,integrityNames,tableNames}
  from '../scripts/collect-recovery-manifest.mjs';
import {requirePrivateRoot,verifySourceEnv,localDatabase}
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
assert.equal(requirePrivateRoot('/tmp/ays-private-recovery'),'/tmp/ays-private-recovery');
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

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const recovery=read('../scripts/local-recovery.mjs');
const collector=read('../scripts/collect-recovery-manifest.mjs');
const jwt=read('../scripts/local-jwt-e2e.mjs');
const e2e=read('../scripts/security-two-accounts-e2e.mjs');
const ignore=read('../.gitignore');
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
assert.match(e2e,/assert\.ok\(localHost&&localPort/);
assert.match(e2e,/!denyJoin\.ok\|\|denyJoin\.data===null/);
assert.match(ignore,/supabase\/\.temp\//);
console.log('PASS: private backup manifest, local Docker guard and two-JWT safety checks');

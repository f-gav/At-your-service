#!/usr/bin/env node
/**
 * Read-only, local-operator inventory. No database URL/password in arguments,
 * stdout or GitHub. psql receives connection information via PG* environment
 * variables (or a local .pg_service.conf / password file).
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const countNames=['characters','admins','published_templates','template_drafts',
  'template_versions','portrait_objects','new_portrait_references','legacy_portrait_references',
  'game_rooms','room_members','room_rolls'];
export const integrityNames=['missing_source_objects','missing_card_objects','missing_sheet_objects',
  'unreferenced_portrait_objects','versions_with_missing_template','invalid_room_memberships',
  'broken_room_roll_links','malformed_member_snapshots','malformed_roll_dice'];
export const tableNames=['characters','sheet_admins','sheet_templates','sheet_template_drafts',
  'sheet_template_history','game_rooms','game_room_members','game_room_rolls'];

export function parseReport(integrityOutput,fingerprintOutput){
  const lines=integrityOutput.trim().split(/\r?\n/).filter(Boolean).map(v=>v.trim());
  if(lines.length!==7)throw new Error('Expected seven integrity rows (counts, links, four JSON groups, rooms)');
  const nums=(line,n)=>{const v=line.split('|').map(Number);assert.equal(v.length,n,'Wrong inventory column count');assert.ok(v.every(x=>Number.isSafeInteger(x)&&x>=0),'Invalid inventory integer');return v;};
  const counts=Object.fromEntries(countNames.map((key,i)=>[key,nums(lines[0],11)[i]]));
  const integrity={};
  const first=nums(lines[1],5),last=nums(lines[6],4);
  for(let i=0;i<5;i++)integrity[integrityNames[i]]=first[i];
  for(let i=0;i<4;i++)integrity[integrityNames[i+5]]=last[i];
  for(let i=2;i<6;i++){
    const parts=lines[i].split('|');
    if(parts.length!==3||!['characters','templates','drafts','history'].includes(parts[0]))
      throw new Error('Invalid JSON inventory group');
    if(!Number.isSafeInteger(Number(parts[1]))||Number(parts[2])!==0)
      throw new Error('Invalid JSON data detected, abort backup certification');
  }
  const fingerprints={};
  const hashLines=fingerprintOutput.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(hashLines.length,8,'Missing fingerprint table rows');
  for(const line of hashLines){
    const [table,rows,sha,...extra]=line.trim().split('|');
    assert.ok(tableNames.includes(table)&&extra.length===0&&!(table in fingerprints),
      'Unknown or duplicated table fingerprint');
    assert.match(sha??'',/^[a-f0-9]{64}$/,'Incorrect database row fingerprint');
    assert.ok(Number.isSafeInteger(Number(rows))&&Number(rows)>=0);
    fingerprints[table]=sha;
  }
  for(const table of tableNames)assert.ok(fingerprints[table],'Missing '+table);
  return {counts,integrity,fingerprints};
}
export function readPsqlFile(sqlFile,env=process.env){
  const child=spawnSync('psql',['-X','-q','-A','-t','-F','|','-v','ON_ERROR_STOP=1','-f',sqlFile],{
    cwd:root,env:{...env,PGOPTIONS:'-c default_transaction_read_only=on'},
    encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,
  });
  if(child.error||child.status!==0)throw new Error('Read-only psql inventory failed; inspect local private logs only');
  return child.stdout;
}
export function collectInventory(env=process.env){
  const a=readPsqlFile(path.join(root,'supabase/backup-integrity.sql'),env);
  const b=readPsqlFile(path.join(root,'supabase/restore-row-fingerprints.sql'),env);
  return parseReport(a,b);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const target=process.argv[2];
  if(!target||!path.isAbsolute(target)||path.resolve(target).startsWith(root+path.sep))
    throw Error('Supply an absolute output file OUTSIDE the Git repository');
  if(!process.env.PGHOST||!process.env.PGUSER||!process.env.PGPASSWORD)
    throw Error('PGHOST, PGUSER and PGPASSWORD must be set locally; never pass secrets as args');
  const report=collectInventory();
  await writeFile(target,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('PASS: read-only inventory collected locally (no user identifiers printed)');
}

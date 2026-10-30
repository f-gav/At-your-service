#!/usr/bin/env node
/**
 * Safe operator handoff: emits only non-sensitive pass/fail/NOT_RUN states.
 * Does not print user data, file paths, file hashes, credentials or JWT.
 * May run on Windows 11 with Node 22 without Docker or live DB access.
 */
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {requirePrivateRoot,inspectBackup,resolveStorageObjectsRoot} from './local-recovery.mjs';
import {compareBackupRestore} from './verify-restore.mjs';

const root=requirePrivateRoot(process.env.AYS_RECOVERY_ROOT);
const file=async name=>{
  try{await access(path.join(root,name));return true;}catch{return false;}
};
async function main(){
  let backup='NOT_RUN',restore='NOT_RUN',jwt='NOT_RUN';
  if(await file('source.json')){
    try{
      await inspectBackup(root);
      backup='PASS';
    }catch{backup='FAIL';}
  }
  if(await file('restored.json')){
    if(backup!=='PASS')restore='BLOCKED';
    else try{
      const source=JSON.parse(await readFile(path.join(root,'source.json'),'utf8'));
      const restored=JSON.parse(await readFile(path.join(root,'restored.json'),'utf8'));
      const sourceStorage=await resolveStorageObjectsRoot(path.join(root,'storage'),
        source.counts.portrait_objects);
      const restoredStorage=await resolveStorageObjectsRoot(path.join(root,'restored-storage'),
        source.counts.portrait_objects);
      await compareBackupRestore(source,restored,sourceStorage,restoredStorage);
      restore='PASS';
    }catch{restore='FAIL';}
  }
  if(await file('local-e2e-pass.json')){
    if(restore!=='PASS')jwt='BLOCKED';
    else try{
      const evidence=JSON.parse(await readFile(path.join(root,'local-e2e-pass.json'),'utf8'));
      jwt=evidence.scope==='localhost-only'&&evidence.outcome==='PASS'?'PASS':'FAIL';
    }catch{jwt='FAIL';}
  }
  console.log('At your service! / Stage 1 / operator acceptance');
  console.log('PREFLIGHT: OPERATOR_CHECK_REQUIRED');
  console.log('BACKUP: '+backup);
  console.log('RESTORE: '+restore);
  console.log('LOCAL_TWO_JWT_E2E: '+jwt);
  console.log('GOOGLE_OAUTH_E2E: NOT_RUN');
  console.log('PRODUCTION_RATE_LIMIT: NOT_INSTALLED');
  console.log('No private values are included in this report.');
  if([backup,restore,jwt].includes('FAIL')||[backup,restore,jwt].includes('BLOCKED'))
    process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await main();
export {main};

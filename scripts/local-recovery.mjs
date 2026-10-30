#!/usr/bin/env node
/**
 * At your service! local recovery runner. Requires Docker, Supabase CLI,
 * PostgreSQL 17 client and explicit local operator login/link.
 *
 * backup: remote READ operations only.
 * restore: writes ONLY into freshly initialized Docker Supabase on localhost.
 * NEVER accepts a remote restore URL or production write command.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile,stat,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectInventory,readPsqlFile} from './collect-recovery-manifest.mjs';
import {compareBackupRestore} from './verify-restore.mjs';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref='cvimyqmksxeigjnofexf';
const bucket='character-portraits';
export const localDatabase={PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres'};
export const testedCliVersion='2.122.0';

/** Avoid libpq overrides taking precedence over the intended host or service. */
export function safePostgresEnv(base,connection){
  const env={...base};
  for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGPASSFILE',
    'PGOPTIONS','PGDATABASE','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGSSLMODE',
    'SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD',
    'AYS_E2E_OWNER_JWT','AYS_E2E_OUTSIDER_JWT']){
    delete env[key];
  }
  return {...env,...connection,PGSSLMODE:connection.PGHOST==='127.0.0.1'?'disable':'require'};
}
export function assertCliVersion(raw){
  const version=raw.trim().replace(/^v/,'').split(/\s+/)[0];
  if(version!==testedCliVersion)
    throw Error('Expected Supabase CLI '+testedCliVersion+', got '+version+
      '. Recheck command flags and upgrade/pin before recovery.');
  return version;
}
export function assertLocalDatabaseStatus(raw){
  const match=raw.match(/^DB_URL=(.+)$/m);
  if(!match)throw Error('Supabase local status omitted DB_URL; abort restore');
  const parsed=new URL(match[1].trim().replace(/^["']|["']$/g,''));
  if(!['127.0.0.1','localhost'].includes(parsed.hostname) ||
      parsed.port!==localDatabase.PGPORT || parsed.username!=='postgres' ||
      parsed.pathname!=='/postgres')
    throw Error('Local Supabase DB does not match expected loopback 54322');
  return true;
}

export function requirePrivateRoot(raw){
  if(!raw||!path.isAbsolute(raw))throw Error('AYS_RECOVERY_ROOT must be an absolute private directory');
  const resolved=path.resolve(raw);
  if(resolved===repoRoot||resolved.startsWith(repoRoot+path.sep))
    throw Error('Private backups may NOT be stored in the Git checkout');
  if(resolved===path.parse(resolved).root)throw Error('Cannot use drive root for sensitive backups');
  return resolved;
}
export function verifySourceEnv(env){
  if(env.AYS_SOURCE_PROJECT_REF!==ref)throw Error('Wrong remote project ref');
  const host=env.PGHOST??'',user=env.PGUSER??'';
  if(!env.PGPASSWORD||!user)throw Error('Missing PG* variables; do not put passwords in shell args');
  if(env.PGHOSTADDR||env.PGSERVICE||env.PGSERVICEFILE)
    throw Error('Remove PGHOSTADDR/PGSERVICE overrides before source backup');
  if(!['5432','6543'].includes(env.PGPORT??'5432'))
    throw Error('Unexpected remote PostgreSQL port');
  const direct=host===`db.${ref}.supabase.co`;
  const pool=/\.pooler\.supabase\.com$/.test(host)&&user.includes(ref);
  if(!direct&&!pool)throw Error('PGHOST/PGUSER do not identify At your service! production');
  if(env.PGSSLMODE && !['require','verify-ca','verify-full'].includes(env.PGSSLMODE))
    throw Error('Remote PostgreSQL connections must require TLS');
}
function call(program,args,{cwd=repoRoot,env=process.env,timeout=900000}={}){
  // stdin is used for operator authentication; never echo child output which
  // may contain connection strings, project identifiers or private paths.
  const run=spawnSync(program,args,{cwd,env,stdio:['inherit','pipe','pipe'],
    timeout,maxBuffer:5*1024*1024,encoding:'utf8'});
  if(run.error||run.status!==0)throw Error('Local recovery command failed: '+program+' (inspect private operator session)');
  return run.stdout;
}
async function countFiles(dir){
  let n=0;
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(item.isSymbolicLink())throw Error('Symlink in private Storage download');
    if(item.isDirectory())n+=await countFiles(path.join(dir,item.name));
    else if(item.isFile())n++;
    else throw Error('Unrecognized Storage file');
  }
  return n;
}
export async function resolveStorageObjectsRoot(folder,expectedCount){
  // Depending on CLI destination conventions, recursive copy may place
  // objects directly under folder or under folder/<bucket>.
  const entries=await readdir(folder);
  const nested=path.join(folder,bucket);
  const onlyNested=entries.length===1 && entries[0]===bucket &&
    (await stat(nested)).isDirectory();
  const result=onlyNested?nested:folder;
  if(await countFiles(result)!==expectedCount)
    throw Error('Unexpected Storage copy layout or incomplete object transfer');
  return result;
}
async function hashFile(file){
  const h=createHash('sha256');
  for await(const chunk of createReadStream(file))h.update(chunk);
  return h.digest('hex');
}
async function exists(f){try{await access(f);return true;}catch{return false;}}
async function checkFresh(root){
  if(await exists(root)){
    const names=await readdir(root);
    if(names.length)throw Error('Recovery directory is not empty. Never overwrite existing private backups.');
  }else await mkdir(root,{recursive:true,mode:0o700});
}
async function verifyLinkedProject(){
  const file=path.join(repoRoot,'supabase','.temp','project-ref');
  const project=(await readFile(file,'utf8').catch(()=>'' )).trim();
  if(project!==ref)throw Error('Supabase CLI must first link to the intended read-only source project');
}
export async function backup(root,env=process.env){
  verifySourceEnv(env);
  await verifyLinkedProject();
  await checkFresh(root);
  const folder=path.join(root,'db');
  await mkdir(folder,{recursive:true,mode:0o700});
  const remoteEnv={...env,PGSSLMODE:env.PGSSLMODE??'require'};
  if(readPsqlFile(path.join(repoRoot,'supabase/storage-source-guard.sql'),remoteEnv).trim()!=='PASS')
    throw Error('Remote portrait Storage policies drifted; abort rather than making an unfaithful restore');
  const before=collectInventory(remoteEnv);
  const dumps=[
    ['roles.sql',['db','dump','--linked','--role-only']],
    ['schema.sql',['db','dump','--linked']],
    ['data.sql',['db','dump','--linked','--data-only','--use-copy']],
  ];
  for(const [name,args] of dumps){
    call('supabase',[...args,'--file',path.join(folder,name)]);
    const info=await stat(path.join(folder,name));
    if(info.size===0)throw Error('Empty database dump: '+name);
  }
  // Supabase CLI excludes managed auth and storage schemas. A separate
  // auth-data export is mandatory (and will be handled as sensitive).
  const authFile=path.join(folder,'auth-data.sql');
  call('pg_dump',['--data-only','--schema=auth','--no-owner','--no-privileges',
    '--file',authFile],{env:remoteEnv,timeout:900000});
  const storageRoot=path.join(root,'storage');
  await mkdir(storageRoot,{recursive:true,mode:0o700});
  if(before.counts.portrait_objects>0)
    call('supabase',['storage','cp','-r',`ss:///${bucket}`,storageRoot,
      '--linked','--experimental']);
  const objects=await resolveStorageObjectsRoot(storageRoot,before.counts.portrait_objects);
  const fileCount=await countFiles(objects);
  const after=collectInventory(remoteEnv);
  if(JSON.stringify(before)!==JSON.stringify(after))
    throw Error('Source changed during export; backup is UNVERIFIED, do not certify it');
  if(fileCount!==after.counts.portrait_objects)
    throw Error('Storage export count does not match the DB metadata; backup is UNVERIFIED');
  const digests={};
  for(const name of [...dumps.map(d=>d[0]),'auth-data.sql'])
    digests[name]=await hashFile(path.join(folder,name));
  await writeFile(path.join(root,'source.json'),JSON.stringify(after,null,2)+'\n',
    {flag:'wx',mode:0o600});
  await writeFile(path.join(root,'db-digests.json'),JSON.stringify(digests,null,2)+'\n',
    {flag:'wx',mode:0o600});
  console.log('PASS: export completed and pre/post inventories match. NOT YET A VERIFIED RESTORE.');
}
export async function restore(root){
  const source=JSON.parse(await readFile(path.join(root,'source.json'),'utf8'));
  const destination=path.join(root,'local-only');
  if(await exists(destination))throw Error('Local restore workspace exists; refusing to overwrite');
  await mkdir(destination,{recursive:true,mode:0o700});
  call('supabase',['init'],{cwd:destination});
  // This workspace is deliberately NOT linked to the remote project.
  if(await exists(path.join(destination,'supabase','.temp','project-ref')))
    throw Error('Local workspace unexpectedly linked to a remote project');
  const localEnv=safePostgresEnv(process.env,localDatabase);
  call('supabase',['start'],{cwd:destination,env:localEnv,timeout:1200000});
  assertLocalDatabaseStatus(call('supabase',['status','-o','env'],{cwd:destination,env:localEnv,timeout:30000}));
  const db=path.join(root,'db');
  const input=['roles.sql','schema.sql','auth-data.sql','data.sql'];
  const digests=JSON.parse(await readFile(path.join(root,'db-digests.json'),'utf8'));
  for(const item of input){
    if(!await exists(path.join(db,item)))
      throw Error('Missing required backup file: '+item);
    if(!/^[a-f0-9]{64}$/.test(digests[item]??'') ||
       await hashFile(path.join(db,item))!==digests[item])
      throw Error('DB dump checksum changed: '+item+' (restore aborted)');
  }
  // Restore only against a hardcoded loopback endpoint, never --linked.
  call('psql',['-X','-h','127.0.0.1','-p','54322','-U','postgres',
    '-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction',
    '-f',path.join(db,'roles.sql'),
    '-f',path.join(db,'schema.sql'),
    '-c','SET session_replication_role = replica',
    '-f',path.join(db,'auth-data.sql'),
    '-f',path.join(db,'data.sql')],{cwd:destination,env:localEnv,timeout:900000});
  // The generic dump excludes managed Storage policies and buckets.
  // Restore only the audited local definition, after database import.
  // Supabase Storage API will materialize storage.objects for uploaded bytes.
  call('psql',['-X','-h','127.0.0.1','-p','54322','-U','postgres',
    '-d','postgres','-v','ON_ERROR_STOP=1',
    '-f',path.join(repoRoot,'supabase/proposals/local-restore-portrait-storage.sql')],
    {cwd:destination,env:localEnv});
  if(readPsqlFile(path.join(repoRoot,'supabase/storage-source-guard.sql'),localEnv).trim()!=='PASS')
    throw Error('Local private Storage policies differ from validated source');
  const sourceStorage=await resolveStorageObjectsRoot(
    path.join(root,'storage'),source.counts.portrait_objects);
  if(source.counts.portrait_objects>0)
    call('supabase',['storage','cp','-r',sourceStorage,
      `ss:///${bucket}`,'--local','--experimental'],{cwd:destination,env:localEnv});
  const restoredStorage=path.join(root,'restored-storage');
  await mkdir(restoredStorage,{recursive:true,mode:0o700});
  if(source.counts.portrait_objects>0)
    call('supabase',['storage','cp','-r',`ss:///${bucket}`,restoredStorage,
      '--local','--experimental'],{cwd:destination,env:localEnv});
  const restoredStorageObjects=await resolveStorageObjectsRoot(
    restoredStorage,source.counts.portrait_objects);
  const restored=collectInventory(localEnv);
  await compareBackupRestore(source,restored,
    sourceStorage,restoredStorageObjects);
  await writeFile(path.join(root,'restored.json'),JSON.stringify(restored,null,2)+'\n',
    {flag:'wx',mode:0o600});
  console.log('PASS: local DB row fingerprints and private Storage SHA-256 match.');
  console.log('Auth provider configuration and real two-JWT API E2E still require separate checks.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2];
  if(!['backup','restore','preflight'].includes(mode)||process.argv.length!==3)
    throw Error('Usage: node scripts/local-recovery.mjs preflight|backup|restore');
  const root=requirePrivateRoot(process.env.AYS_RECOVERY_ROOT);
  if(mode==='preflight'){
    call('docker',['info'],{timeout:30000});
    assertCliVersion(call('supabase',['--version'],{timeout:30000}));
    for(const [name,args] of Object.entries({
      supabase:['db','dump','--help'],psql:['--version'],
      pg_dump:['--version'],node:['--version'],
    }))call(name,args,{timeout:30000});
    const storageHelp=call('supabase',['storage','cp','--help'],{timeout:30000});
    for(const flag of ['--linked','--local','--experimental','--recursive'])
      if(!storageHelp.includes(flag))throw Error('Supabase CLI missing '+flag);
    console.log('PASS: pinned CLI '+testedCliVersion+', Docker and recovery commands available');
  }else if(mode==='backup'){
    assertCliVersion(call('supabase',['--version'],{timeout:30000}));
    await backup(root);
  }
  else {
    assertCliVersion(call('supabase',['--version'],{timeout:30000}));
    await restore(root);
  }
}

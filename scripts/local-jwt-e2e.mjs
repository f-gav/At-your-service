#!/usr/bin/env node
/**
 * Disposable, real Supabase Auth E2E after DB+Storage restore has been verified.
 * Uses ONLY 127.0.0.1:54321, synthetic users, local service-role key and
 * local-only Postgres. Never prints keys, JWTs, user IDs or passwords.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {requirePrivateRoot,localDatabase,safePostgresEnv,assertLocalDatabaseStatus} from './local-recovery.mjs';
import {collectInventory} from './collect-recovery-manifest.mjs';

function localStatus(workdir){
  const proc=spawnSync('supabase',['status','-o','env'],
    {cwd:workdir,encoding:'utf8',timeout:30000});
  if(proc.error||proc.status!==0)throw Error('Local Supabase CLI not running');
  const parsed={};
  for(const line of proc.stdout.split(/\r?\n/)){
    const match=line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?$/);
    if(match)parsed[match[1]]=match[2];
  }
  const url=parsed.API_URL;
  assert.ok(url==='http://127.0.0.1:54321'||url==='http://localhost:54321',
    'Local E2E can only target localhost:54321');
  assertLocalDatabaseStatus(proc.stdout);
  assert.ok(parsed.SERVICE_ROLE_KEY&&parsed.ANON_KEY,
    'Missing local CLI keys, do not use production credentials');
  return {url,serviceKey:parsed.SERVICE_ROLE_KEY,anonKey:parsed.ANON_KEY};
}
const root=requirePrivateRoot(process.env.AYS_RECOVERY_ROOT);
const restored=JSON.parse(await readFile(path.join(root,'restored.json'),'utf8'));
assert.ok(restored&&restored.fingerprints,
  'Local recovery verification must PASS before creating synthetic users');
const workdir=path.join(root,'local-only');
const {url,serviceKey,anonKey}=localStatus(workdir);
const localEnv=safePostgresEnv(process.env,localDatabase);
assert.deepEqual(collectInventory(localEnv),restored,
  'Local restored data changed since verification; do not create JWT fixtures');
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const unique=randomBytes(6).toString('hex');
async function userFixture(label){
  const email=`ays-e2e-${label}-${unique}@example.test`;
  const password=randomBytes(30).toString('base64url')+'aA1!';
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error||!data.user)throw Error('Could not create local test user');
  const signIn=await client().auth.signInWithPassword({email,password});
  if(signIn.error||!signIn.data.session?.access_token)
    throw Error('Local Supabase Auth login failed');
  const id=data.user.id;
  const inserted=await admin.from('characters').insert({
    user_id:id,system:'pf2e',name:'Local '+label,details:{},
  }).select('id').single();
  if(inserted.error||!inserted.data)throw Error('Failed to create synthetic local character');
  return {id,characterId:inserted.data.id,token:signIn.data.session.access_token};
}
try{
  const owner=await userFixture('owner');
  const outsider=await userFixture('outsider');
  const room=await admin.from('game_rooms').insert({
    owner_id:owner.id,system:'pf2e',title:'Local E2E room',
  }).select('id').single();
  if(room.error||!room.data)throw Error('Could not create local test room');
  const member=await admin.from('game_room_members').insert({
    room_id:room.data.id,character_id:owner.characterId,user_id:owner.id,
  });
  if(member.error)throw Error('Could not add owner fixture to local room');
  // Production RLS requires user-id/character-id/32hex-source.webp and
  // the bucket allows image/webp only. A PNG would fail or bypass the
  // meaningful private read test.
  const portraitPath=owner.id+'/'+owner.characterId+'/' +
    randomBytes(16).toString('hex')+'-source.webp';
  const imageBytes=Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64');
  const upload=await admin.storage.from('character-portraits')
    .upload(portraitPath,imageBytes,{contentType:'image/webp',upsert:false});
  if(upload.error)throw Error('Local synthetic portrait upload failed');
  // Staging RPC SQL is applied strictly on local PostgreSQL AFTER restore was
  // compared with source, leaving all restored fixtures available for E2E.
  const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
    '../supabase/proposals/room-rpc-quotas-staging.sql');
  const apply=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1',
    '-p','54322','-U','postgres','-d','postgres','-f',script],{
      cwd:workdir,env:localEnv,
      encoding:'utf8',timeout:30000,
    });
  if(apply.error||apply.status!==0)throw Error('Local-only RPC quota proposal failed');
  Object.assign(process.env,{
    AYS_E2E_SUPABASE_URL:url,
    AYS_E2E_PUBLISHABLE_KEY:anonKey,
    AYS_E2E_OWNER_JWT:owner.token,
    AYS_E2E_OUTSIDER_JWT:outsider.token,
    AYS_E2E_ROOM_ID:room.data.id,
    AYS_E2E_OWNER_PORTRAIT_PATH:portraitPath,
    AYS_E2E_ISOLATED_RESTORE:'YES',
    AYS_E2E_ALLOW_RPC_WRITES:'YES',
    AYS_E2E_PRODUCTION_PROJECT_REF:'cvimyqmksxeigjnofexf',
  });
  await import('./security-two-accounts-e2e.mjs?local-verified');
  // Never store JWTs, account IDs or tokens in evidence.
  await writeFile(path.join(root,'local-e2e-pass.json'),
    JSON.stringify({scope:'localhost-only',outcome:'PASS',method:'two-synthetic-auth-jwts',
      verifiedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('PASS: real local Supabase two-JWT Auth/RLS/Storage/negative RPC tests');
  console.log('NOTE: synthetic local users are not production Google OAuth sessions');
}catch{
  console.error('FAIL: local two-JWT integration; inspect private local logs only');
  process.exitCode=1;
}

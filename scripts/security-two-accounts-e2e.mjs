#!/usr/bin/env node
/**
 * Two REAL non-admin Supabase Auth JWTs; read-only cross-account E2E by default.
 * Do not paste tokens into source code, CLI arguments, PRs or GitHub logs.
 * Optional negative RPC checks are hard-disabled against production.
 *
 * Usage: see docs/STAGE-1-RPC-BACKUP-ITER3.md.
 */
import assert from 'node:assert/strict';

const env=process.env;
const required=name=>{
  const value=env[name]?.trim();
  if(!value)throw new Error('Missing environment variable '+name+' (no requests sent)');
  return value;
};
const url=new URL(required('AYS_E2E_SUPABASE_URL'));
assert.equal(url.protocol,'https:');
assert.match(url.hostname,/^[a-z0-9-]+\.supabase\.co$/);
const origin=url.origin;
const key=required('AYS_E2E_PUBLISHABLE_KEY');
const ownerToken=required('AYS_E2E_OWNER_JWT');
const outsiderToken=required('AYS_E2E_OUTSIDER_JWT');
assert.notEqual(ownerToken,outsiderToken,'Use two DIFFERENT authenticated sessions');
const roomId=required('AYS_E2E_ROOM_ID');
const portraitPath=required('AYS_E2E_OWNER_PORTRAIT_PATH');
assert.match(roomId,/^[0-9a-f-]{36}$/i);
if(portraitPath.startsWith('/')||portraitPath.includes('..'))throw Error('Invalid private object path');
const headers=jwt=>({
  apikey:key,
  Authorization:'Bearer '+jwt,
  Accept:'application/json',
});
async function call(jwt,pathname,{method='GET',body}={}){
  const response=await fetch(origin+pathname,{
    method,headers:{...headers(jwt),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    redirect:'error',
  });
  const data=await response.text();
  let parsed;
  try{parsed=JSON.parse(data);}catch{parsed=null;}
  // Never log raw bodies: error responses can contain sensitive identifiers.
  return {status:response.status,ok:response.ok,data:parsed};
}
async function rows(jwt,table,query){
  const response=await call(jwt,'/rest/v1/'+table+'?'+query);
  assert.ok(response.ok,'Failed to query '+table+' (HTTP '+response.status+')');
  assert.ok(Array.isArray(response.data),'Expected collection from '+table);
  return response.data;
}
function eq(v){return encodeURIComponent('eq.'+v);}
const owner=await call(ownerToken,'/auth/v1/user');
const outsider=await call(outsiderToken,'/auth/v1/user');
assert.ok(owner.ok&&outsider.ok&&owner.data?.id&&outsider.data?.id,
  'Both JWTs must represent valid authenticated users');
assert.notEqual(owner.data.id,outsider.data.id,'JWTs resolve to the same user');
const [ownerAdmin,outsiderAdmin]=await Promise.all([
  rows(ownerToken,'sheet_admins','select=user_id'),
  rows(outsiderToken,'sheet_admins','select=user_id'),
]);
assert.equal(ownerAdmin.length,0,'Owner test account must NOT be an administrator');
assert.equal(outsiderAdmin.length,0,'Outsider test account must NOT be an administrator');

const [ownerCharacters,outsiderCharacters]=await Promise.all([
  rows(ownerToken,'characters','select=id%2Cuser_id'),
  rows(outsiderToken,'characters','select=id%2Cuser_id'),
]);
assert.ok(ownerCharacters.length>0&&outsiderCharacters.length>0,
  'Both accounts need their own pre-existing test character');
assert.ok(ownerCharacters.every(c=>c.user_id===owner.data.id));
assert.ok(outsiderCharacters.every(c=>c.user_id===outsider.data.id));
const ownerChar=ownerCharacters[0].id;
const outsiderChar=outsiderCharacters[0].id;
assert.deepEqual(await rows(outsiderToken,'characters','select=id&id='+eq(ownerChar)),[]);
assert.deepEqual(await rows(ownerToken,'characters','select=id&id='+eq(outsiderChar)),[]);
console.log('PASS: real non-admin JWT identities and private characters');

const [ownerRoom,outsiderRoom]=await Promise.all([
  rows(ownerToken,'game_rooms','select=id%2Cowner_id%2Cinvite_code&id='+eq(roomId)),
  rows(outsiderToken,'game_rooms','select=id&id='+eq(roomId)),
]);
assert.equal(ownerRoom.length,1,'Room not visible to its owner or wrong fixture room');
assert.equal(ownerRoom[0].owner_id,owner.data.id,'Room must belong to the owner account');
assert.deepEqual(outsiderRoom,[],'Outsider can see owner room');
const [ownerMembers,outsiderMembers,outsiderRolls]=await Promise.all([
  rows(ownerToken,'game_room_members','select=room_id&room_id='+eq(roomId)),
  rows(outsiderToken,'game_room_members','select=room_id&room_id='+eq(roomId)),
  rows(outsiderToken,'game_room_rolls','select=id&room_id='+eq(roomId)),
]);
assert.ok(ownerMembers.length>0,'Room fixture needs at least one member');
assert.deepEqual(outsiderMembers,[],'Outsider can see room members');
assert.deepEqual(outsiderRolls,[],'Outsider can see roll history');
console.log('PASS: owner-only room and outsider isolation');

const path=portraitPath.split('/').map(encodeURIComponent).join('/');
const privateUrl='/storage/v1/object/authenticated/character-portraits/'+path;
const ownPortrait=await call(ownerToken,privateUrl);
assert.equal(ownPortrait.status,200,'Owner should read the test portrait');
const foreignPortrait=await call(outsiderToken,privateUrl);
assert.ok([401,403,404].includes(foreignPortrait.status),
  'Outsider accessed private portrait (HTTP '+foreignPortrait.status+')');
console.log('PASS: private portrait Storage access');

// Direct RPC calls are potentially MUTATING. Never run this section against
// production, even when the expected test case should be denied.
if(env.AYS_E2E_ISOLATED_RESTORE==='YES'){
  assert.equal(env.AYS_E2E_ALLOW_RPC_WRITES,'YES',
    'Explicit opt-in required for RPC tests in isolated restored project');
  assert.notEqual(url.hostname,'cvimyqmksxeigjnofexf.supabase.co',
    'Production project is forbidden for mutating RPC test cases');
  assert.equal(env.AYS_E2E_PRODUCTION_PROJECT_REF?.length>0,true,
    'Supply production project ref to avoid testing the wrong environment');
  assert.notEqual(url.hostname,env.AYS_E2E_PRODUCTION_PROJECT_REF+'.supabase.co');
  const post=async(name,args)=>call(outsiderToken,'/rest/v1/rpc/'+name,{method:'POST',body:args});
  const denyJoin=await post('join_game_room',{p_code:ownerRoom[0].invite_code,p_character:ownerChar});
  assert.equal(denyJoin.ok,false,'Outsider joined with a foreign character');
  const denyRoll=await post('post_game_room_roll',{
    p_room:roomId,p_character:ownerChar,p_formula:'1d6',p_label:'negative auth fixture',
    p_total:3,p_calculation:'1d6 = 3',p_dice:[],
  });
  assert.equal(denyRoll.ok,false,'Outsider posted a forged roll');
  console.log('PASS: isolated negative RPC authorization tests');
}else{
  console.log('SKIP: RPC POST tests require isolated restored Supabase + explicit opt-in');
}
console.log('PASS: Stage 1 E2E completed without logging any user identifiers or tokens');

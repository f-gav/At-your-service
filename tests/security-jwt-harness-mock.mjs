import assert from 'node:assert/strict';

// NO production requests. Mock fetch exercises the actual two-JWT harness.
const owner='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const room='33333333-3333-4333-8333-333333333333';
const characterA='44444444-4444-4444-8444-444444444444';
const characterB='55555555-5555-4555-8555-555555555555';
Object.assign(process.env,{
  AYS_E2E_SUPABASE_URL:'https://fixture-only.supabase.co',
  AYS_E2E_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_TEST',
  AYS_E2E_OWNER_JWT:'test-not-a-jwt-owner',
  AYS_E2E_OUTSIDER_JWT:'test-not-a-jwt-outsider',
  AYS_E2E_ROOM_ID:room,
  AYS_E2E_OWNER_PORTRAIT_PATH:owner+'/portrait.webp',
});
delete process.env.AYS_E2E_ISOLATED_RESTORE;
delete process.env.AYS_E2E_ALLOW_RPC_WRITES;
let requestCount=0, writeCount=0, mode='safe';
globalThis.fetch=async (input,init)=>{
  requestCount++;
  const u=new URL(input);
  if(u.host!=='fixture-only.supabase.co')throw Error('Test attempted to contact unexpected host');
  if(init.method!=='GET')writeCount++;
  const actor=init.headers.Authorization.endsWith('test-not-a-jwt-owner')?owner:outsider;
  const respond=(data,status=200)=>new Response(
    typeof data==='string'?data:JSON.stringify(data),
    {status,headers:{'Content-Type':'application/json'}});
  if(u.pathname==='/auth/v1/user')return respond({id:actor});
  if(u.pathname==='/rest/v1/sheet_admins')return respond([]);
  if(u.pathname==='/rest/v1/characters'){
    const known=actor===owner?{id:characterA,user_id:owner}:{id:characterB,user_id:outsider};
    const filter=u.searchParams.get('id');
    return respond(!filter||filter==='eq.'+known.id?[known]:[]);
  }
  if(u.pathname==='/rest/v1/game_rooms'){
    return respond(actor===owner||mode==='leak-room'?[{id:room,owner_id:owner,invite_code:'ABCDEF12'}]:[]);
  }
  if(u.pathname==='/rest/v1/game_room_members')return respond(actor===owner?[{room_id:room}]:[]);
  if(u.pathname==='/rest/v1/game_room_rolls')return respond([]);
  if(u.pathname.startsWith('/storage/v1/object/authenticated/')){
    return respond('TEST IMAGE NOT PRIVATE',actor===owner||mode==='leak-portrait'?200:403);
  }
  throw Error('Unhandled synthetic fixture endpoint: '+u.pathname);
};
await import('../scripts/security-two-accounts-e2e.mjs?mock-safe');
assert.ok(requestCount>0);
assert.equal(writeCount,0,'Read-only E2E must never POST against production');
mode='leak-room';
await assert.rejects(
  import('../scripts/security-two-accounts-e2e.mjs?mock-leak-room'),/Outsider can see owner room/
);
mode='safe';
assert.equal(writeCount,0);
console.log('PASS: two-account E2E fixture validates access and catches leaks without network writes');

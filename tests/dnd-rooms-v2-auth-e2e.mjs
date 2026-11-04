import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';

const variables=Object.fromEntries(readFileSync('.local-supabase-status','utf8')
 .split(/\r?\n/).filter(line=>line.includes('='))
 .map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^["']|["']$/g,'')]}));
const url=variables.API_URL, key=variables.ANON_KEY;
assert.match(url||'',/^http:\/\/(127\.0\.0\.1|localhost):54321$/);
assert.ok(key);
const pg={...process.env,PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres'};
const sql=q=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-At','-c',q],{env:pg,encoding:'utf8'}).trim();
const check=(r,label)=>{assert.ifError(r.error,label);return r.data};
const mk=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function user(label){
 const c=mk(), email='ays-'+label+'-'+randomUUID()+'@example.test',password='Local-'+randomUUID();
 const r=check(await c.auth.signUp({email,password}),'signup '+label);
 assert.ok(r.session?.access_token,'Local Auth confirmations must be disabled');
 assert.equal(r.session.access_token.split('.').length,3);
 assert.equal(JSON.parse(Buffer.from(r.session.access_token.split('.')[1],'base64url').toString()).sub,r.user.id);
 return {id:r.user.id,c};
}
const a=await user('owner'),b=await user('member'),outsider=await user('outsider'),racer=await user('racer');
assert.equal(new Set([a.id,b.id,outsider.id,racer.id]).size,4);
console.log('PASS: Four genuine locally signed Supabase Auth JWT identities');
const char=(u,system='dnd5e')=>{
 const id=randomUUID();
 const data=JSON.stringify({dnd5eSheet:{schemaVersion:1,rulesEdition:'2024',layoutEdition:'2014',
 identity:{level:4},combat:{hp:{current:21,maximumBase:25,temporary:2},
 ac:{baseExpression:'13',shieldEquipped:false}},content:{blocks:{note:'PRIVATE'}}}});
 sql(`INSERT INTO public.characters(id,user_id,name,system,details) VALUES
 ('${id}','${u.id}','Fixture','${system}','${system==='dnd5e'?data:'{}'}'::jsonb)`);
 return id;
};
const aid=char(a),bid=char(b),oid=char(outsider,'pf2e'),rid=char(racer);
const room=randomUUID();
sql("NOTIFY pgrst, 'reload schema'");
await new Promise(r=>setTimeout(r,1800));
check(await a.c.from('game_rooms').insert({id:room,owner_id:a.id,system:'dnd5e',invite_code:'A1B2C3D4'}),'create');
assert.equal(check(await outsider.c.from('game_rooms').select('id').eq('id',room),'outsider').length,0);
assert.equal(check(await a.c.from('game_rooms').select('id').eq('id',room),'owner').length,1);
assert.equal(check(await outsider.c.rpc('join_game_room',{p_code:'A1B2C3D4',p_character:oid}),'cross system'),null);
assert.equal(check(await b.c.rpc('join_game_room',{p_code:'A1B2C3D4',p_character:bid}),'join'),room);
const snap=check(await a.c.from('game_room_members').select('snapshot').eq('room_id',room),'snapshot');
assert.equal(snap.length,1);
assert.equal(snap[0].snapshot.hpCurrent,'21');
assert.ok(!JSON.stringify(snap).includes('PRIVATE'));
assert.equal(check(await outsider.c.from('game_room_members').select('room_id'),'private memberships').length,0);
console.log('PASS: Real JWT RLS, owner-only visibility, cross-system deny, RPC and snapshot secrecy');

let received=false, realtimeEvents=0, realtimeError=null;
const channel=a.c.channel('e2e-'+randomUUID())
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_room_members'},
 payload=>{realtimeEvents++;if(payload.new?.room_id===room && payload.new?.snapshot?.hpCurrent==='17')received=true});
try{
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Realtime subscription timed out')),15000);
  channel.subscribe(status=>{
   if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve()}
   if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timeout);reject(Error(status))}
  });
 });
 await new Promise(r=>setTimeout(r,1500));
}catch(error){realtimeError=error;console.warn('DIAGNOSTIC: Realtime subscription:',error.message)}
const mine=check(await b.c.from('characters').select('details').eq('id',bid).single(),'own sheet');
mine.details.dnd5eSheet.combat.hp.current=17;
check(await b.c.from('characters').update({details:mine.details}).eq('id',bid).select('id').single(),'save HP');
const persisted=check(await a.c.from('game_room_members').select('snapshot').eq('character_id',bid).single(),'read updated snapshot');
assert.equal(persisted.snapshot.hpCurrent,'17','trigger must refresh snapshot');
if(!realtimeError)for(let i=0;i<50&&!received;i++)await new Promise(r=>setTimeout(r,500));
if(!received){
 console.log('DIAGNOSTIC: Realtime events',realtimeEvents,'publication table',sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='game_room_members'"));
 realtimeError ||= Error('Actual Realtime UPDATE was not delivered');
}
await a.c.removeChannel(channel);
if(!realtimeError)console.log('PASS: Real Realtime event delivered after authenticated autosave');

const racing=await Promise.all([1,2,3].map(()=>racer.c.rpc('join_game_room',{p_code:'A1B2C3D4',p_character:rid})));
assert.equal(racing.filter(x=>!x.error&&x.data===room).length,1);
const rows=check(await a.c.from('game_room_members').select('character_id').eq('room_id',room),'members');
assert.equal(rows.filter(x=>x.character_id===rid).length,1);
console.log('PASS: Concurrent signed-JWT requests created precisely one membership');
if(realtimeError)throw realtimeError;

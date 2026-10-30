import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
const exec=promisify(execFile);
const pg={...process.env,PGCONNECT_TIMEOUT:'5'};
const user='44444444-4444-4444-8444-444444444444';
const room='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const character='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
async function psql(sql){
  const {stdout}=await exec('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],
    {env:pg,timeout:30000,maxBuffer:10240});
  return stdout.trim().split('\n').filter(Boolean).at(-1);
}
// Start close to the beginning of the next quota window, allowing all
// concurrent requests to compete for a single indexed row.
const phase=Date.now()%10000;
if(phase>1000)await new Promise(resolve=>setTimeout(resolve,10015-phase));
const sql=`SET request.jwt.claim.sub='${user}';
SET ROLE authenticated;
SELECT coalesce(public.post_game_room_roll(
  '${room}'::uuid,'${character}'::uuid,
  '1d6','concurrency-test',3,'1d6 = 3','[]'::jsonb
)::text,'DENIED')`;
const results=await Promise.all(Array.from({length:16},()=>psql(sql)));
const accepted=results.filter(value=>/^[a-f0-9-]{36}$/i.test(value));
const denied=results.filter(value=>value==='DENIED');
assert.equal(results.length,16);
assert.equal(accepted.length,10,'Atomic quota must accept exactly ten parallel calls');
assert.equal(denied.length,6,'Atomic quota must reject six parallel calls');
const rows=await psql(`SELECT count(*) FROM public.game_room_rolls
 WHERE user_id='${user}'::uuid`);
const budget=await psql(`SELECT coalesce(sum(attempts),0)
 FROM ays_rooms_private.room_rpc_quotas
 WHERE user_id='${user}'::uuid AND operation='roll'`);
assert.equal(Number(rows),10,'Concurrent accepted rolls must be persisted');
assert.equal(Number(budget),10,'Budget may not exceed ten under contention');
console.log('PASS: 16 concurrent PostgreSQL RPC calls -> 10 accepted, 6 denied');

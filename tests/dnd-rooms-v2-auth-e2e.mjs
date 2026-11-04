import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const variables=Object.fromEntries(readFileSync('.local-supabase-status','utf8')
  .split(/\r?\n/).filter(line=>line.includes('='))
  .map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).replace(/^["']|["']$/g,'')]}));
const endpoint=variables.API_URL;
assert.match(endpoint||'',/^http:\/\/(127\.0\.0\.1|localhost):54321$/);
const key=variables.ANON_KEY;
assert.ok(key);
const make=()=>createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function user(label){
  const c=make();
  const email='ays-'+label+'-'+randomUUID()+'@example.test';
  const password='LocalTestOnly-'+randomUUID();
  const response=await c.auth.signUp({email,password});
  assert.ifError(response.error);
  assert.ok(response.data.session?.access_token,'Local email confirmation must be disabled');
  const jwt=response.data.session.access_token;
  assert.equal(jwt.split('.').length,3);
  assert.equal(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).sub,response.data.user.id);
  return {c,id:response.data.user.id};
}
const alice=await user('alice'),bob=await user('bob');
assert.notEqual(alice.id,bob.id);
console.log('PASS: Two genuine locally issued Supabase Auth JWTs; unique subjects');
const a=await alice.c.from('game_rooms').select('id');
const b=await bob.c.from('game_rooms').select('id');
assert.ifError(a.error);
assert.ifError(b.error);
console.log('PASS: Both signed JWT sessions reach PostgREST with RLS active');

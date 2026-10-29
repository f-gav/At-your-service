import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const proposal=read('../supabase/proposals/room-rpc-quotas-staging.sql');
const fingerprintSql=read('../supabase/restore-row-fingerprints.sql');
const dice=read('../src/lib/DiceRollPanel.tsx');
const restore=read('../scripts/verify-restore.mjs');
const records=read('../tests/restore-verify.mjs');

assert.ok(proposal.includes('STAGING PROPOSAL ONLY')&&
  proposal.includes('Not inside supabase/migrations'));
assert.match(proposal,/on conflict\(user_id,operation,window_slot\) do update/);
assert.match(proposal,/where ays_rooms_private\.room_rpc_quotas\.attempts < quota/);
assert.match(proposal,/revoke all on ays_rooms_private\.room_rpc_quotas from public,anon,authenticated/);
assert.match(proposal,/revoke all on function ays_rooms_private\.take_room_rpc_quota\(text\)/);
assert.match(proposal,/where c\.id=p_character and c\.user_id=caller/);
assert.match(proposal,/m\.user_id=caller and m\.casts_enabled=true/);
assert.match(proposal,/when unique_violation or check_violation or foreign_key_violation/);
assert.match(proposal,/if not ays_rooms_private\.take_room_rpc_quota\('join'\) then return null/);
assert.match(proposal,/if not ays_rooms_private\.take_room_rpc_quota\('roll'\) then return null/);
assert.match(proposal,/grant execute on function public\.join_game_room\(text,uuid\) to authenticated/);
assert.match(proposal,/to authenticated;\s*-- Operational cleanup/);
assert.ok(!proposal.includes('drop table public.game_rooms'),'Never modify room data in a quota plan');
assert.ok(dice.includes('!postedRollId')&&dice.includes('сервер отклонил запрос'),
  'Roll client must not interpret throttled NULL UUID as success');

const sql=fingerprintSql.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
assert.match(sql,/BEGIN READ ONLY;/);
assert.match(sql,/SET LOCAL TIME ZONE/);
assert.match(sql,/ROLLBACK;/);
assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|COPY)\b/i);
for(const table of [
  'characters','sheet_admins','sheet_templates','sheet_template_drafts',
  'sheet_template_history','game_rooms','game_room_members','game_room_rolls',
]){
  assert.ok(fingerprintSql.includes('from public.'+table+' t'),
    'Missing full-row fingerprint for '+table);
}
assert.match(fingerprintSql,/sha256\(convert_to/);
assert.match(restore,/Different restored row contents/);
assert.match(records,/Different restored row contents: characters/);
console.log('PASS: staging-only RPC quotas, null-rejection handling and DB row fingerprint safeguards');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const security=read('../supabase/security-audit.sql');
const integrity=read('../supabase/backup-integrity.sql');
const personas=read('../supabase/security-rls-personas.sql');
const initialRoom=read('../supabase/migrations/20261026_game_rooms.sql');
const multiRoom=read('../supabase/migrations/20261027_multi_room_characters.sql');

// The committed audit scripts must be safely runnable on the real database.
// Ignore comments and quoted SQL text; no DDL or data-changing DML anywhere.
for(const [name,sql] of Object.entries({security,integrity,personas})){
  const bare=sql.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.doesNotMatch(bare,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO|EXECUTE|COPY)\b/i,
    name+' is a read-only inspection script; never modify production');
}
for(const table of ['characters','sheet_admins','sheet_templates','sheet_template_drafts','sheet_template_history',
  'game_rooms','game_room_members','game_room_rolls']){
  assert.ok(security.includes("'"+table+"'"),'RLS inventory missing '+table);
  assert.ok(integrity.includes('public.'+table),'Backup inventory missing '+table);
}
for(const text of ['invalid_room_memberships','broken_room_roll_links',
  'malformed_member_snapshots','malformed_roll_dice',
  'missing_source_objects','missing_card_objects','missing_sheet_objects',
  'unreferenced_portrait_objects','versions_with_missing_template']){
  assert.ok(integrity.includes(text),'Backup restore integrity missing '+text);
}
assert.ok(security.includes("has_function_privilege")&&security.includes("has_table_privilege"));
assert.ok(security.includes('prosecdef')&&security.includes('pg_policies'));
assert.ok(security.includes('post_game_room_roll')&&security.includes('join_game_room'));

assert.equal((personas.match(/BEGIN READ ONLY;/g)||[]).length,4);
assert.equal((personas.match(/^ROLLBACK;/gm)||[]).length,4);
assert.equal((personas.match(/SET LOCAL ROLE authenticated;/g)||[]).length,3);
assert.ok(personas.includes('SET LOCAL ROLE anon;'));
assert.ok(personas.includes("set_config('request.jwt.claim.sub'"));
assert.ok(personas.includes('foreign_characters')&&personas.includes('foreign_portraits'));
assert.ok(personas.includes('visible_template_drafts')&&personas.includes('visible_rolls'));
// Changing role and JWT context is safe only inside the rollback-only block.
// API requests with real signed JWTs are still required for E2E acceptance.
assert.ok(personas.includes('do NOT replace two real JWT/API E2E tests'));

for(const snippet of [
  "if caller is null then raise exception 'Sign in required'",
  'where c.id=p_character and c.user_id=caller',
  'destination.system<>chosen.system',
  'm.user_id=caller',
  'm.casts_enabled=true',
  'revoke all on function public.join_game_room(text,uuid) from public,anon',
  'revoke all on function public.post_game_room_roll',
  'grant update(casts_enabled) on public.game_room_members to authenticated',
]){
  assert.ok(initialRoom.includes(snippet),'Missing RPC security invariant: '+snippet);
}
assert.ok(multiRoom.includes('drop constraint if exists game_room_members_character_id_key'));
assert.ok(read('../docs/STAGE-1-SECURITY-2026-10-29.md').includes('Один персонаж — только одна комната'),
  'Do not lose the approved single-room requirement for the future Rooms block');

console.log('PASS: stage 1 security inventory, RLS persona checks, room RPC invariants and room-aware recovery counts');

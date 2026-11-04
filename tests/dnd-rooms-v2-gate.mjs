import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canAttachCharacter} from '../src/features/rooms/room-state.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hub=read('src/features/rooms/RoomsHub.tsx');
const repo=read('src/features/rooms/room-repository.ts');
const state=read('src/features/rooms/room-state.ts');
const css=read('src/features/rooms/RoomsHub.css');
const sql=read('supabase/proposals/dnd-rooms-v2-approval-required.sql');
const workflow=read('.github/workflows/deploy.yml');
assert.equal(canAttachCharacter('dnd5e','dnd5e',false),true);
assert.equal(canAttachCharacter('dnd5e','pf2e',false),false);
assert.equal(canAttachCharacter('prmoon','dnd5e',false),false);
assert.equal(canAttachCharacter('dnd5e','dnd5e',true),false);
assert.match(state,/RoomSystem='pf2e'\|'prmoon'\|'dnd5e'/);
assert.match(hub,/DND_ROOMS_V2_ENABLED=import\.meta\.env\.VITE_DND_ROOMS_V2==='true'/);
assert.match(hub,/DND_ROOMS_V2_ENABLED&&c\.system==='dnd5e'/);
assert.match(hub,/DND_ROOMS_V2_ENABLED&&<option value="dnd5e">/);
assert.match(repo,/system:'pf2e'\|'prmoon'\|'dnd5e'/);
assert.match(hub,/<Resource label="ХП" current=\{snap\.hpCurrent\} max=\{snap\.hpMax\}\/>/);
assert.match(hub,/Базовая КЗ/);
assert.match(hub,/snap\.rulesEdition/);
assert.match(css,/ays-room-system-dnd5e/);
assert.match(workflow,/VITE_DND_ROOMS_V2:\s*['"]true['"]/,
  'Published Vite build must deliberately enable D&D Rooms after applied migration');
assert.ok(read('supabase/migrations/20261104191201_enable_dnd5e_rooms_v2_guarded.sql').includes("CHECK (system IN ('pf2e','prmoon','dnd5e'))"),
  'Applied D&D migration must be recorded in repository');
assert.doesNotMatch(sql,/ALTER TABLE public\.characters/i);
assert.doesNotMatch(sql,/DROP POLICY|CREATE POLICY/i,'Existing RLS must remain unchanged');
assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.join_game_room/,
  'Must not overwrite an existing quota-aware join RPC wholesale');
assert.match(sql,/replace\(current_join,old_allowed,new_allowed\)/);
assert.match(sql,/room_snapshot\(text,text,jsonb\)/);
assert.match(sql,/dnd_room_snapshot\(text,jsonb\)/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/REVOKE ALL ON FUNCTION .*join_game_room/);
assert.match(sql,/game_rooms_system_check/);
assert.match(sql,/CHECK \(system IN \('pf2e','prmoon','dnd5e'\)\)/);
for(const fixture of [
 'tests/fixtures/dnd-rooms-v2-baseline.sql',
 'tests/fixtures/dnd-rooms-v2-rls.sql'
])assert.ok(workflow.includes(fixture),'Missing CI fixture: '+fixture);
assert.match(workflow,/Apply proposed D&D Rooms SQL ONLY to ephemeral CI PostgreSQL/);
assert.ok(!read('supabase/migrations/20261027_multi_room_characters.sql').includes("'dnd5e'"),
  'User production migration must not be silently changed');
console.log('PASS: D&D Rooms V2 approved release flag, applied migration ledger source, whitelisted snapshots and isolated RLS gate');

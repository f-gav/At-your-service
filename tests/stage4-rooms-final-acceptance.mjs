import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hub=read('src/features/rooms/RoomsHub.tsx');
const deployment=read('.github/workflows/deploy.yml');
const fixture=read('tests/fixtures/rooms-v2-rls-final.sql');
const migrations=[read('supabase/migrations/20261026_game_rooms.sql'),
  read('supabase/migrations/20261027_multi_room_characters.sql')];
const rls=migrations[0],multi=migrations[1];
assert.ok(hub.includes('Clear private room data before the next account'));
assert.ok(hub.includes('++overviewRequest.current;++roomRequest.current;activeRoom.current=null;'));
assert.match(hub,/setRooms\(\[\]\);setMine\(\[\]\);setRoomCounts\(\{\}\);setMembers\(\[\]\);setRolls\(\[\]\)/);
assert.match(hub,/setSelected\(null\);setError\(''\);setLoading\(false\)/);
for(const required of [
 'rooms_participants_read','rooms_owner_edit','rooms_owner_delete',
 'members_participants_read','members_toggle_self','members_self_or_owner_leave',
 'rolls_participants_read','m.casts_enabled=true','room_snapshot',
 'room_character_lock','where m.character_id=new.id and m.user_id=new.user_id'
])assert.ok(rls.includes(required),'Production SQL guard missing '+required);
assert.ok(multi.includes('drop constraint if exists game_room_members_character_id_key'));
assert.ok(multi.includes('m.room_id=destination.id and m.character_id=p_character'));
for(const required of ['SET ROLE authenticated','Outsider can read room data',
 'Participant cannot see shared compact room','Owner cannot change room settings',
 'ROLLBACK;'])assert.ok(fixture.includes(required),'Isolated SQL RLS acceptance missing '+required);
assert.ok(deployment.includes('Verify published Rooms release'));
assert.ok(deployment.includes('release.get(\'revision\') != expected'));
console.log('PASS Rooms V2 final source/RLS/session cleanup and release contract');

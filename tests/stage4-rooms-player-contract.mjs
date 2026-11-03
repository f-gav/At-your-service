import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('src/features/rooms/RoomsHub.tsx');
const sql=read('supabase/migrations/20261027_multi_room_characters.sql');
for(const guard of [
 'roomMembershipCounts=useMemo',
 'counts.set(member.character_id,(counts.get(member.character_id)??0)+1)',
 "' · комнат: '+roomMembershipCounts.get(c.id)",
 'setSelected(current=>current&&!availableRooms.some(item=>item.id===current)?null:current)',
 'activeRoom.current=data as string',
 'activeRoom.current=item.id',
 'activeRoom.current=null',
 'eligible.some(c=>c.id===inviteCharacter)',
])assert.ok(ui.includes(guard),'Player multi-room regression: '+guard);
assert.ok(!ui.includes("' · уже в комнате'"),'Misleading single-room label must not return');
assert.ok(sql.includes('drop constraint if exists game_room_members_character_id_key'));
assert.ok(sql.includes('m.room_id=destination.id and m.character_id=p_character'));
for(const field of ['snap.hpCurrent','snap.hpMax','snap.hpTemp','snap.ac','snap.stCurrent','snap.stMax','snap.spCurrent','snap.spMax'])
 assert.ok(ui.includes(field),'Missing system resource: '+field);
assert.ok(ui.includes('member.user_id===userId&&local'),'Own sheet only');
assert.ok(ui.includes('member.user_id===userId')&&ui.includes('isOwner'),'Leave/kick guard absent');
console.log('PASS Rooms V2 package 4: multi-room, room departure and both systems resource contracts');

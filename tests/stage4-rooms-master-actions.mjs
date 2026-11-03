import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requireRoomMutationRows} from '../src/features/rooms/room-action-guard.ts';
assert.doesNotThrow(()=>requireRoomMutationRows([{id:'room'}],null,'conflict'));
assert.throws(()=>requireRoomMutationRows([],null,'conflict'),/conflict/);
assert.throws(()=>requireRoomMutationRows(null,null,'conflict'),/conflict/);
const forbidden=new Error('permission denied');
assert.throws(()=>requireRoomMutationRows([],forbidden,'conflict'),error=>error===forbidden);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hub=read('src/features/rooms/RoomsHub.tsx');
const repoSource=read('src/features/rooms/room-repository.ts');
const sql=read('supabase/migrations/20261026_game_rooms.sql');
for(const part of [
 'operationLock.current=true', 'if(operationLock.current)return',
 'operationLock.current=false', 'requireRoomMutationRows(data,failure,',
 'renameRoomRow(room.id,roomTitleDraft.trim(),room.title,userId!)',
 'setRoomClosed(room.id,next,userId!)', 'deleteRoomRow(room.id,userId!)'
])assert.ok(hub.includes(part),'Missing serialized/guarded action: '+part);
for(const part of [
 ".eq('owner_id',ownerId).eq('title',previousTitle).select('id')",
 ".eq('owner_id',ownerId).eq('closed',!closed).select('id')",
 ".eq('owner_id',ownerId).select('id')",
 ".eq('casts_enabled',!enabled).select('character_id')",
 ".eq('character_id',characterId).select('character_id')"
])assert.ok(repoSource.includes(part),'Missing optimistic row predicate: '+part);
for(const part of ['rooms_owner_edit','rooms_owner_delete','members_self_or_owner_leave','members_toggle_self'])
assert.ok(sql.includes(part),'Server-side RLS policy absent: '+part);
assert.ok(!hub.includes(".from('game_rooms')"));
console.log('PASS Rooms V2 bundle 3: owner checks, operation serialization, conflict detection and row grants');

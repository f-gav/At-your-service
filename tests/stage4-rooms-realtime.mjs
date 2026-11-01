import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const hub=readFileSync(new URL('../src/features/rooms/RoomsHub.tsx',import.meta.url),'utf8');
for(const guard of [
 'request!==overviewRequest.current',
 'request!==roomRequest.current||activeRoom.current!==roomId',
 '++overviewRequest.current',
 '++roomRequest.current',
 "status==='SUBSCRIBED'",
 "window.addEventListener('online',reconnect)",
 "window.removeEventListener('online',reconnect)",
 "document.addEventListener('visibilitychange',visible)",
 "document.removeEventListener('visibilitychange',visible)",
 "document.visibilityState!=='hidden'"
]) assert.ok(hub.includes(guard),'Missing stale data/reconnect guard: '+guard);
assert.match(hub,/setMembers\(\[\]\);setRolls\(\[\]\)/);
assert.match(hub,/window\.clearInterval\(timer\)/);
console.log('PASS Rooms V2 bundle 2: response fencing, room switch cleanup, reconnect and visibility recovery');

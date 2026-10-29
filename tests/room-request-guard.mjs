import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoomRequestGuard} from '../src/lib/room-request-guard.ts';

const guard=createRoomRequestGuard();
assert.equal(guard('join','',0),true);
assert.equal(guard('join','',1),true);
assert.equal(guard('join','',2),false);
assert.equal(guard('join','',10000),true,'join budget replenishes at 10 seconds');
assert.equal(guard('join','',10001),true);
assert.equal(guard('join','',10002),false);

for(let i=0;i<10;i++)assert.equal(guard('roll','A',i*10),true,'first ten per-character rolls permitted');
assert.equal(guard('roll','A',101),false,'eleventh roll blocked');
assert.equal(guard('roll','B',101),true,'character buckets are independent');
assert.equal(guard('roll','A',10000),true,'oldest roll expires after one window');

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const dice=read('../src/lib/DiceRollPanel.tsx');
const rooms=read('../src/features/rooms/RoomsHub.tsx');
assert.ok(dice.includes("takeRoomRequestPermit('roll',characterId)"));
assert.ok(rooms.includes("takeRoomRequestPermit('join')"));
assert.ok(dice.includes('результат остался локально'));
assert.ok(read('../src/lib/room-request-guard.ts').includes('NOT an abuse defense'));

console.log('PASS: browser room RPC burst guard; local rolls remain available');

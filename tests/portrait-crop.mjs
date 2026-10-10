import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cropGeometry} from '../src/features/portrait/crop.ts';
const size={width:900,height:1320};
const square=cropGeometry(size,{width:240,height:240},{zoom:1,dx:0,dy:0});
assert.ok(square.sx>=0 && square.sy>=0);
assert.ok(square.sx+square.sw<=size.width+.01);
assert.ok(square.sy+square.sh<=size.height+.01);
assert.ok(Math.abs(square.sw-square.sh)<.01);
const rect=cropGeometry(size,{width:240,height:354},{zoom:1,dx:0,dy:0});
assert.ok(rect.sx>=0 && rect.sy>=0 && rect.sx+rect.sw<=size.width+.01 && rect.sy+rect.sh<=size.height+.01);
const moved=cropGeometry(size,{width:240,height:240},{zoom:1.5,dx:999999,dy:-999999});
assert.ok(moved.sx>=-.01 && moved.sy>=-.01 && moved.sx+moved.sw<=size.width+.01 && moved.sy+moved.sh<=size.height+.01);
for(const f of ['App.tsx','features/pathfinder/PathfinderSheet.tsx','lib/character-json.ts']) {
  const text=readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
  assert.match(text,/portrait|Portrait/);
}
const json=readFileSync(new URL('../src/lib/character-json.ts',import.meta.url),'utf8');
assert.match(json,/portraitToJson/);
assert.match(json,/parsePortraitTransfer/);
console.log('Portrait crop geometry & JSON export/import wiring passed');

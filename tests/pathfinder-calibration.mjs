import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const fields = JSON.parse(read('../src/features/pathfinder/fields.json'));
const map = JSON.parse(read('./fixtures/pf2e-fillable-reference-map.json'));
const protectedOriginal = JSON.parse(read('./fixtures/pf2e-protected-fields.json'));
const rows = new Map(fields.map(row=>[row.id,row]));
assert.equal(fields.length,373,'No fields may be added/removed during visual calibration');
assert.equal(new Set(fields.map(x=>x.id)).size,373,'Stable IDs are required for existing JSON');
assert.equal(Object.keys(map).length,341,'Expected precise reference field count');
assert.equal(Object.keys(protectedOriginal).length,21);
for(const [id,rect] of Object.entries(map)){
  const f = rows.get(id);
  assert.ok(f,'Reference ID is missing: '+id);
  assert.deepEqual([f.x,f.y,f.w,f.h],rect,'Source fallback mismatch: '+id);
  assert.equal(f.adjusted,true,'No secondary fieldBox shifting on calibrated fields: '+id);
}
for(const [id,rect] of Object.entries(protectedOriginal)){
  const f=rows.get(id);
  assert.ok(f,'Protected ID missing: '+id);
  assert.deepEqual([f.x,f.y,f.w,f.h],rect,'Locked source field changed: '+id);
  assert.equal(map[id],undefined,'Locked field must not be auto-calibrated: '+id);
}
for(const f of fields){
  assert.ok(f.x>=0&&f.y>=0&&f.w>=3&&f.h>=3,'Invalid size: '+f.id);
  assert.ok(f.x+f.w<=601.1&&f.y+f.h<=782.5,'Out-of-bounds field: '+f.id);
}
const css=read('../src/features/pathfinder/PathfinderSheet.css');
const ui=read('../src/features/pathfinder/PathfinderSheet.tsx');
assert.match(ui,/className="pf-toolbar-heading"/);
assert.match(css,/\.pf-toolbar-heading\s*\{/);
assert.match(css,/@media\s*\(max-width:\s*1120px\)/);
assert.match(css,/width:max\(100%, 24px\)/);
console.log('PF2e PDF calibration: 341 mapped, 21 locked, 373 stable IDs; header responsive.');

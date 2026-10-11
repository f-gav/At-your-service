import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DYING_SKULL_COUNT,readDyingSkulls,toggleDyingSkull} from '../src/features/pathfinder/dying-skulls.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
assert.equal(DYING_SKULL_COUNT,4);
for(let i=0;i<=4;i++)assert.equal(readDyingSkulls(String(i)),i);
assert.equal(readDyingSkulls('+2'),2);
assert.equal(readDyingSkulls('5'),4);
assert.equal(readDyingSkulls('10'),4);
assert.equal(readDyingSkulls(''),0);
assert.equal(readDyingSkulls('NaN'),0);
assert.equal(readDyingSkulls('выбрать'),0);
assert.equal(readDyingSkulls(null),0);
// Clicking marks changes numeric Dying severity in order, not individual
// disconnected booleans or select-menu choices.
assert.equal(toggleDyingSkull('0',1),'1');
assert.equal(toggleDyingSkull('1',2),'2');
assert.equal(toggleDyingSkull('2',4),'4');
assert.equal(toggleDyingSkull('4',4),'3');
assert.equal(toggleDyingSkull('2',2),'1');
assert.equal(toggleDyingSkull('1',1),'0');
assert.equal(toggleDyingSkull('4',1),'1');
assert.equal(toggleDyingSkull('4',0),'4');
assert.equal(toggleDyingSkull('2',5),'2');

const fields=JSON.parse(read('../src/features/pathfinder/fields.json'));
const dying=fields.find(f=>f.id==='dying');
assert.equal(dying.kind,'counter','Keep the original published template metadata');
assert.equal(dying.page,1);
assert.equal(dying.max,4);
assert.equal(fields.filter(f=>f.id==='dying').length,1);

const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const visual=read('../src/features/pathfinder/DyingSkulls.tsx');
const css=read('../src/features/pathfinder/DyingSkulls.css');
assert.match(sheet,/if \(field\.id === 'dying'\)/);
assert.match(sheet,/return <DyingSkulls key=\{field\.id\} style=\{style\} value=\{values\.dying\}/);
assert.match(sheet,/onChange=\{next=>change\('dying',next\)\}/);
assert.ok(sheet.indexOf("field.id === 'dying'")<sheet.indexOf("RANK_FIELDS.has(field.id)"),
  'Special death skull handler must run before ordinary inputs');
assert.match(visual,/Array\.from\(\{length:DYING_SKULL_COUNT\}/);
assert.match(visual,/type="button"/);
assert.match(visual,/aria-pressed=\{selected\}/);
assert.match(visual,/onClick=\{\(\)=>onChange\(toggleDyingSkull\(value,slot\)\)\}/);
assert.doesNotMatch(visual,/<select|<input|window\.confirm/);
assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
assert.match(css,/\[aria-pressed="true"\] \.pf-dying-skull-ink/);
assert.match(css,/fill: transparent/);
assert.match(css,/pointer-events: none/);
console.log('PF2e Dying: four directly clickable skulls with PDF-aligned hitboxes, ink toggling and old numeric data intact.');

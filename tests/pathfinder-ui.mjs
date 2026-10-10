import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathfinderSubtitle } from '../src/features/pathfinder/summary.ts';
import { fieldBox } from '../src/features/pathfinder/layout.ts';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const fields = JSON.parse(read('../src/features/pathfinder/fields.json'));
const source = read('../src/features/pathfinder/PathfinderSheet.tsx');
const styles = read('../src/features/pathfinder/PathfinderSheet.css');
const summary = read('../src/features/pathfinder/summary.ts');
const layout = read('../src/features/pathfinder/layout.ts');

assert.equal(fields.length, 373);
assert.deepEqual([...new Set(fields.map(f => f.page))], [1, 2, 3, 4]);
assert.match(source, /PAGE_TITLES\.map\(\(_, index\) => renderPage\(index \+ 1\)\)/);
assert.match(source, /page-\$\{page\}\.webp/);
assert.match(source, /loading=\{page === 1 \? 'eager' : 'lazy'\}/);
assert.doesNotMatch(source, /pf-page-tabs|pf-zoom|pf-title-row/);
assert.match(summary, /sheet\.ancestry/);
assert.match(summary, /sheet\.character_class/);
assert.match(layout, /feat_level_\|class_level_/);
assert.equal(pathfinderSubtitle({ pathfinderSheet: { ancestry: 'Эльф', character_class: 'Некромант' } }), 'Эльф - Некромант');
assert.equal(pathfinderSubtitle({ pathfinderSheet: { ancestry: 'Эльф' } }), 'Эльф - Класс');
assert.equal(pathfinderSubtitle({}), 'Народ - Класс');
const level2 = fields.find(f => f.id === 'feat_level_2');
assert.ok(level2);
assert.equal(fieldBox(level2).y, level2.y + 4);
assert.doesNotMatch(styles, /#447a63|#8ab7a0|#f2fbf4/i);
for (const n of [1, 2, 3, 4]) {
  const image = fs.readFileSync(new URL(`../public/pathfinder/page-${n}.webp`, import.meta.url));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  assert.equal(image.toString('ascii', 12, 16), 'VP8L');
  const packed = image.readUInt32LE(21);
  assert.equal((packed & 0x3fff) + 1, 3005);
  assert.equal(((packed >>> 14) & 0x3fff) + 1, 3912);
}
console.log('PF2e UI tests passed: all four pages, 373 fields, high-resolution images, home subtitle.');

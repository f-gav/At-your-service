import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL(path,import.meta.url),'utf8');
const app = source('../src/App.tsx');
const sheet = source('../src/features/project-moon/ProjectMoonSheet.tsx');
const card = source('../src/features/project-moon/MoonPortrait.tsx');
const cardCSS = source('../src/features/project-moon/MoonPortrait.css');
const portraitEditor = source('../src/features/portrait/PortraitEditor.tsx');

for (const path of ['../public/project-moon/portrait-frame.png','../public/project-moon/portrait-placeholder.png']) {
  const buf = readFileSync(new URL(path,import.meta.url));
  assert.deepEqual([...buf.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(buf.readUInt32BE(16),384);
  assert.equal(buf.readUInt32BE(20),586);
}
assert.ok(app.includes("character.system === 'prmoon'"));
assert.ok(app.includes('<MoonPortrait compact'));
assert.ok(app.includes('character.portrait_crops?.sheet'), 'Home thumb reuses the sheet crop');
assert.ok(app.includes('system={portraitCharacter.system}'));
assert.ok(sheet.includes('<MoonPortrait url={portraitUrl} frame={portraitFrame} name={name} />'));
assert.ok(card.includes('!compact && <span className="moon-portrait-art-caption"'));
assert.ok(card.includes('moon-portrait-art--compact'));
assert.ok(card.includes('project-moon/portrait-frame.png'));
assert.ok(card.includes('project-moon/portrait-placeholder.png'));
assert.ok(cardCSS.includes('moon-portrait-art-caption { display:none'));
assert.ok(cardCSS.includes('moon-portrait-art-window'));
assert.ok(cardCSS.includes('height:63.5%'));
assert.ok(cardCSS.includes('.moon-portrait-art-stage {bottom:auto;height:auto;}'));
assert.ok(portraitEditor.includes("system === 'prmoon' ? MOON_SHEET_SIZE : SHEET_SIZE"));
assert.ok(portraitEditor.includes('const SHEET_SIZE={width:480,height:708}'), 'Existing PF crop must be unchanged');
console.log('PASS: Pr. Moon frame + placeholder, sheet-only caption, cropped home thumbnail and per-system crop');

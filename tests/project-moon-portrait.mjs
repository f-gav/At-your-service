import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

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
assert.ok(!app.includes('<MoonPortrait compact'));
assert.ok(app.includes('project-moon/character-icon.png'));
assert.ok(!app.includes('project-moon/portrait-placeholder.png'), 'Old dossier placeholder must not be used as home avatar');
const goblin = readFileSync(new URL('../public/project-moon/character-icon.png',import.meta.url));
assert.deepEqual([...goblin.subarray(0,8)],[137,80,78,71,13,10,26,10]);
assert.equal(goblin.readUInt32BE(16),192);
assert.equal(goblin.readUInt32BE(20),192);
assert.ok(app.includes('character.portrait_crops?.card'));
assert.ok(!app.includes('character.portrait_crops?.sheet'), 'Home thumb uses card crop, not sheet crop');
assert.ok(app.includes('system={portraitCharacter.system}'));
assert.ok(sheet.includes('<MoonPortrait url={portraitUrl} frame={portraitFrame} name={name}'));
assert.ok(sheet.includes('onEditPortrait={previewMode ? undefined : onEditPortrait}'));
assert.ok(card.includes('MOON_PORTRAIT_FRAME'));
assert.ok(card.includes('MOON_PORTRAIT_MASK'));
assert.ok(card.includes('className="moon-portrait-art-mask"'));
assert.ok(card.includes('className="moon-portrait-art-frame"'));
assert.ok(card.includes('className="moon-portrait-art-trigger"'));
assert.ok(card.includes('onClick={onEditPortrait}'));
assert.ok(card.includes('className="moon-portrait-art-caption"'));
assert.ok(!card.includes('moon-portrait-art-stage'), 'Old misaligned stage must be removed');
assert.ok(!card.includes('compact'), 'Home uses a normal square silhouette');
assert.ok(cardCSS.includes('aspect-ratio:384 / 586'));
assert.ok(cardCSS.includes('.moon-portrait-art-mask {z-index:2;}'));
assert.ok(cardCSS.includes('.moon-portrait-art-frame {z-index:3;}'), 'Frame must overlay the portrait, never behind it');
assert.ok(cardCSS.includes('z-index:4;'), 'Nameplate must overlay the frame');
const knownCompleteFrame = readFileSync(new URL('../public/project-moon/portrait-frame.png',import.meta.url));
assert.equal(createHash('sha256').update(knownCompleteFrame).digest('hex'),
  'd3d06780da3b1bd5cedab3b86eb21759c14b983b76f9da7ea2c913bf261d0bd6',
  'Do not replace the complete frame with a truncated or masked-down PNG');
assert.ok(cardCSS.includes('top:18.09%'));
assert.ok(cardCSS.includes('height:64%'));
assert.ok(!cardCSS.includes('.moon-portrait-art-stage'), 'No second coordinate system');
assert.ok(portraitEditor.includes("system === 'prmoon' ? MOON_SHEET_SIZE : SHEET_SIZE"));
assert.ok(portraitEditor.includes('const SHEET_SIZE={width:480,height:708}'), 'Existing PF crop must be unchanged');
assert.ok(portraitEditor.includes('framePreview={system === \'prmoon\'}'));
assert.ok(portraitEditor.includes('portrait-crop-frame-preview'));
assert.ok(portraitEditor.includes('project-moon/portrait-frame.png'));
const editorCSS = source('../src/features/portrait/PortraitEditor.css');
assert.ok(editorCSS.includes('.portrait-crop-frame-preview .portrait-crop-viewport'));
const moonSheetCSS = source('../src/features/project-moon/ProjectMoonSheet.css');
assert.ok(moonSheetCSS.includes('.moon-portrait-host'));
assert.ok(moonSheetCSS.includes('var(--moon-portrait-width'));
const layoutSettings = source('../src/features/project-moon/layout-settings.ts');
for (const key of ['portraitWidth','portraitShiftX','portraitShiftY']) assert.ok(layoutSettings.includes(key));
console.log('PASS: Pr. Moon frame/mask share coordinates, clickable mask, vertical crop preview and admin layout');

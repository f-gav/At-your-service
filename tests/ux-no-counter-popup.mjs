import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

const app=read('../src/App.tsx');
const appStyles=read('../src/styles.css');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const sheetStyles=read('../src/features/pathfinder/PathfinderSheet.css');
const json=read('../src/lib/character-json.ts');

// The visual portrait is part of the single button opening the sheet,
// not a competing action surface above it.
assert.match(app, /className="character-open"/);
const start=app.indexOf('<button type="button" className="character-open"');
const end=app.indexOf('</button>',start);
assert.ok(start>=0&&end>start);
const button=app.slice(start,end);
assert.match(button, /<span className="character-portrait"/);
assert.match(button, /<PortraitImage url=/);
assert.match(button, /portrait_crops\?\.card/);
assert.match(button, /pathfinder\/portrait-placeholder.webp/);
assert.doesNotMatch(button, /onEditPortrait|setEditingPortraitId/);
assert.doesNotMatch(app, /className="character-portrait-action"/);
assert.doesNotMatch(appStyles, /\.character-portrait-action/);
assert.match(appStyles, /\.character-portrait > img/);
assert.match(appStyles, /\.character-portrait img\.character-portrait-placeholder/);

// Portrait editing still works from within a PF2e character sheet.
assert.match(app, /onEditPortrait=\{\(\)=>setEditingPortraitId\(active\.id\)\}/);
assert.match(sheet, /className="pf-portrait-button"/);

// Counter values are entered in-place: no floating +/- controls.
assert.doesNotMatch(sheet, /focusedCounter|setFocusedCounter|pf-counter-popup|step\(counter/);
assert.doesNotMatch(sheetStyles, /\.pf-counter-popup/);
assert.match(sheet, /const numeric = field.kind === 'number' \|\| field.kind === 'counter';/);
assert.match(sheet, /type="text"/);
assert.match(sheet, /onChange:.*ChangeEvent<HTMLInputElement \| HTMLTextAreaElement>/);

// No changes to transport/storage contracts.
assert.match(json, /version: 1/);
console.log('UX regression: portrait click opens card; no counter popup; JSON remains v1.');

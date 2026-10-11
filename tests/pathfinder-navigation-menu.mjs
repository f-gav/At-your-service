import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {insertionMenuPosition} from '../src/features/pathfinder/insert-menu-position.ts';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const viewport={width:1366,height:800};
const caret={left:310,top:145,bottom:164,height:19};
const tall={left:80,top:95,bottom:610,height:515};
assert.deepEqual(insertionMenuPosition(caret,tall,viewport),{left:310,top:170},
  'Menu must sit under the caret, not under a large editor field');
const emptyCaret={left:0,top:0,bottom:0,height:0};
const byMouse=insertionMenuPosition(emptyCaret,tall,viewport,{x:200,y:180});
assert.deepEqual(byMouse,{left:200,top:186},
  'Zero-size range must use actual click coordinates');
assert.equal(insertionMenuPosition(emptyCaret,tall,viewport).top,125,
  'Without mouse, fallback remains on the first text line');
const nearBottom=insertionMenuPosition({left:380,top:780,bottom:800,height:20},tall,viewport);
assert.ok(nearBottom.top<780,'Toolbar moves above caret at viewport bottom');
assert.equal(insertionMenuPosition(caret,tall,{width:375,height:800}).left,8,
  'Mobile toolbar is clamped within the screen');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const css=read('../src/features/pathfinder/PathfinderSheet.css');
const rich=read('../src/features/pathfinder/RichField.tsx');
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
const schema=read('../src/features/pathfinder/editor-schema.ts');
const layout=read('../src/features/pathfinder/layout.ts');
assert.match(rich,/insertionMenuPosition\(rect,fallback/);
assert.match(rich,/pointerRef\.current=\{x:event\.clientX,y:event\.clientY\}/);
assert.match(sheet,/Помощь в навигации/);
assert.match(sheet,/navigationHelp&&<nav className="pf-navigation-help"/);
assert.match(sheet,/pf-sheet-page-\$\{page\}/);
assert.match(sheet,/scrollIntoView\(\{/);
assert.match(sheet,/ays-pf2e-navigation-help/);
assert.match(sheet,/aria-current=\{activePage===index\+1\?'page':undefined\}/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/\.pf-navigation-help-label \{display:none;\}/);
assert.match(admin,/Поворот четверти круга/);
assert.match(admin,/<option value="quarter">Четверть круга<\/option>/);
assert.match(schema,/tradition_arcane:0, tradition_occult:90/);
assert.match(schema,/tradition_primal:270, tradition_divine:180/);
assert.match(schema,/TOGGLE_ROTATIONS.includes\(a.toggleRotation\)/);
assert.match(layout,/toggleRotation\?: 0 \| 90 \| 180 \| 270/);
console.log('Caret-anchored insert menu, quarter-turn magic toggles and optional four-page navigator regression checks passed.');

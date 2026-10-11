import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {dividerMarkup,spoilerMarkup} from '../src/features/pathfinder/rich-blocks.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const divider=dividerMarkup();
assert.match(divider,/data-pf-divider="1"/);
assert.match(divider,/data-pf-divider-title="1" contenteditable="true"/);
assert.equal(dividerMarkup('<script>'),divider.replace('</span>','&lt;script&gt;</span>'));
assert.doesNotMatch(dividerMarkup('"><img onerror=alert(1)>'),/<img/);

const open=spoilerMarkup('История','<div>Тайна</div>');
const closed=spoilerMarkup('История','<div>Тайна</div>',true);
assert.match(open,/data-pf-spoiler="1" data-collapsed="0"/);
assert.match(closed,/data-pf-spoiler="1" data-collapsed="1"/);
for(const html of [open,closed]){
  assert.match(html,/data-pf-spoiler-title="1" contenteditable="true"/);
  assert.match(html,/data-pf-spoiler-body="1" contenteditable="true"/);
  assert.match(html,/data-pf-spoiler-toggle="1" contenteditable="false"/);
  assert.match(html,/data-pf-spoiler-remove="1" contenteditable="false"/);
  assert.match(html,/>Тайна<\/div>/);
}
assert.match(spoilerMarkup('<svg onload=alert(1)>'),/&lt;svg onload=alert\(1\)&gt;/);
assert.equal(spoilerMarkup('Nested',spoilerMarkup('Inner')).match(/data-pf-spoiler="1"/g)?.length,2);
const rich=read('../src/features/pathfinder/RichField.tsx');
const css=read('../src/features/pathfinder/RichField.css');
const codec=read('../src/features/pathfinder/rich-codec.ts');
const dynamic=read('../src/features/pathfinder/DynamicAdvancement.tsx');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');

assert.match(rich,/function addBlock\(kind:InsertKind\)/);
assert.match(rich,/blankLineAt\(range,editor\)/);
assert.match(rich,/addBlock\('spoiler'\)/);
assert.match(rich,/addBlock\('divider'\)/);
assert.match(rich,/function convertDividerShortcut\(\)/);
assert.match(rich,/line\.textContent!=='---'/);
assert.match(rich,/if\(line===editor\|\|line\.matches\('\[data-pf-spoiler-body\]'\)\)/,
  'Shortcut must not replace the spoiler body element');
assert.match(rich,/onInput=\{\(\)=>\{if\(!convertDividerShortcut\(\)\)emit\(\);\}\}/);
assert.match(rich,/document\.execCommand\('insertHTML'/,'Existing resource and task support must stay usable');
assert.match(rich,/function toggleSpoiler\(spoiler:HTMLElement\)/);
assert.match(rich,/spoiler\.dataset\.collapsed=collapsed\?'0':'1'/);
assert.match(rich,/function removeWidget\(widget:HTMLElement\)/);
assert.match(rich,/event\.key==='Backspace'&&title&&!title\.textContent\?\.trim\(\)/);
assert.match(rich,/role="toolbar"[\s\S]*?Вставить блок на пустую строку/);
assert.match(rich,/editor\.contains\(document\.activeElement\)&&value===ownValue\.current/,
  'Editing a nested spoiler title/body must not reset caret from React render');

assert.match(codec,/if\(el\.tagName==='DIV' && el\.dataset\.pfDivider==='1'\)/);
assert.match(codec,/if\(el\.tagName==='DIV' && el\.dataset\.pfSpoiler==='1'\)/);
assert.match(codec,/el\.dataset\.collapsed==='1'/);
assert.match(codec,/Array\.from\(body\.childNodes\)\.map\(clean\)/,
 'Spoiler contents, including nested tokens, must be sanitized and saved');
assert.match(codec,/spoilerMarkup\(title\?\.textContent\?\?'',content/);
assert.match(codec,/dividerMarkup\(title\?\.textContent\?\?''\)/);
assert.match(codec,/RICH_PREFIX/,'Do not change existing saved field format');

assert.match(css,/\[data-pf-divider="1"\]::before/);
assert.match(css,/\[data-pf-divider="1"\]::after/);
assert.match(css,/\[data-pf-divider-title="1"\]:not\(:empty\)/);
assert.match(css,/\[data-pf-spoiler="1"\]\[data-collapsed="1"\] > \[data-pf-spoiler-body="1"\]/);
assert.match(css,/\.pf-rich-insert-toolbar/);
assert.match(css,/position: fixed/,'No clipping inside PDF');

assert.match(dynamic,/import RichField from '.\/RichField'/);
assert.match(sheet,/if \(field\.kind === 'long'\)[\s\S]*?return <RichField/);
assert.doesNotMatch(rich,/insertOrderedList|dice|d20|roller/);
console.log('PF2e spoiler/divider: insertion, editable centered title, --- shortcut, folding persistence, nesting and safe old storage checks passed.');

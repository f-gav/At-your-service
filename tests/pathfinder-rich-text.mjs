import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signedNumericInput,sanitizeSignedNumericInput} from '../src/features/pathfinder/numeric-input.ts';
import {isRich,richBody,RICH_PREFIX,escapeRichText} from '../src/features/pathfinder/rich-codec.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

for(const input of ['','0','-','+','+12','-43','100002'])assert.ok(signedNumericInput(input),input);
for(const input of ['1d8','4a','abc','+3x','-2-1','12+3','1.5','<script>','∞'])assert.equal(signedNumericInput(input),false,input);
assert.equal(sanitizeSignedNumericInput('−2'),'-2');
assert.equal(sanitizeSignedNumericInput('123abc'),'123');
assert.equal(sanitizeSignedNumericInput('1d8'),'18');
assert.equal(sanitizeSignedNumericInput('++12'),'+12');
assert.equal(sanitizeSignedNumericInput('4.5'),'45');
assert.equal(RICH_PREFIX,'ays:rich:v1:');
assert.equal(isRich(RICH_PREFIX+'<b>a</b>'),true);
assert.equal(richBody(RICH_PREFIX+'<b>a</b>'),'<b>a</b>');
assert.equal(richBody('Старинная черта'),'Старинная черта');
assert.equal(escapeRichText('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');

const schema=read('../src/features/pathfinder/editor-schema.ts');
assert.match(schema,/export function withMagicTraditionHalfCircles/);
assert.match(schema,/toggleShape:'quarter'/);
assert.match(schema,/toggleMode:'fill'/);
assert.match(schema,/field.toggleShape!==undefined&&field.toggleShape!=='semicircle'&&field.toggleShape!=='quarter'/,'Explicit non-tradition shapes remain intact');
assert.match(schema,/withMagicTraditionHalfCircles\(withClassDcNumericBonus/);
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
const rich=read('../src/features/pathfinder/RichField.tsx');
const codec=read('../src/features/pathfinder/rich-codec.ts');
const css=read('../src/features/pathfinder/DynamicAdvancement.css');
const global=read('../src/styles.css');
assert.match(sheet,/sanitizeSignedNumericInput\(event\.target\.value\)/);
assert.match(sheet,/field\.kind==='number'\|\|field\.kind==='counter'/);
assert.match(sheet,/field\.kind === 'long'[\s\S]{0,120}return <RichField/);
assert.match(sheet,/withMagicTraditionHalfCircles/);
assert.match(admin,/withMagicTraditionHalfCircles/);
assert.match(rich,/selectionchange/);
for(const action of ["bold","italic","underline","insertUnorderedList","createLink","resource","task"])
 assert.ok(rich.includes(action),'Missing formatting '+action);
assert.doesNotMatch(rich,/insertOrderedList|dice|d20|roller/);
assert.match(rich,/serializeRichHtml/);
assert.match(rich,/data-pf-resource="1"/);
assert.match(rich,/data-pf-task="1"/);
assert.match(rich,/onInput=\{\(\)=>\{if\(!convertDividerShortcut\(\)\)emit\(\);\}\}/,
 'Rich text changes must still persist and the --- shortcut must convert a divider');
assert.match(codec,/rel="noopener noreferrer"/);
assert.match(codec,/node\.nodeType===Node\.TEXT_NODE/);
assert.match(codec,/if\(!KEEP\.has\(el\.tagName\)\)return inner/);
assert.match(codec,/SCRIPT.*STYLE.*SVG.*IFRAME/);
assert.match(css,/pf-advancement-fixed-art::after/);
assert.match(css,/bottom:\s*0;\s*height:\s*3\.6%/);
assert.match(global,/scale\(1\.08\)/);
console.log('PF2e rich notes, numeric values, quarter-circle traditions, old text storage and footer restoration checked');

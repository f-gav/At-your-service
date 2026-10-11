import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const editor=read('../src/features/pathfinder/TemplateAdmin.tsx');
const css=read('../src/features/pathfinder/PathfinderSheet.css');
const dynamic=read('../src/features/pathfinder/DynamicAdvancement.css');
const fields=JSON.parse(read('../src/features/pathfinder/fields.json'));

const footerHeight=3.35;
const pdfHeight=782.362;
const maskTop=pdfHeight*(1-footerHeight/100);
for(let page=1;page<=4;page++){
  const pageFields=fields.filter(field=>field.page===page);
  const maxFieldBottom=Math.max(...pageFields.map(field=>field.y+field.h));
  assert.ok(maxFieldBottom<maskTop,
    'Footer mask must stay below all page '+page+' editable fields: '+maxFieldBottom+' vs '+maskTop);
}
assert.match(css,/\.pf-page-footer-mask\s*\{[^}]*position:\s*absolute;/);
assert.match(css,/\.pf-page-footer-mask\s*\{[^}]*left:\s*0;[^}]*right:\s*0;[^}]*bottom:\s*0;/);
assert.match(css,/\.pf-page-footer-mask\s*\{[^}]*height:\s*3\.35%;/);
assert.match(css,/\.pf-page-footer-mask\s*\{[^}]*background:\s*#fff;/);
assert.match(css,/\.pf-page-footer-mask\s*\{[^}]*pointer-events:\s*none;/);
assert.match(sheet,/const artwork = <>[\s\S]*?pageFields\.map\(renderField\)[\s\S]*?<div className="pf-page-footer-mask" aria-hidden="true" \/>/);
assert.match(editor,/const artPreview = <>[\s\S]*?fields\.filter[\s\S]*?<div className="pf-page-footer-mask" aria-hidden="true" \/>/);
assert.match(sheet,/isAdvancementPage\s*\?\s*<div className="pf-advancement-fixed-art">\{artwork\}<\/div>/);
assert.match(editor,/page===2\s*\?\s*<div className="pf-advancement-fixed-art">\{artPreview\}<\/div>/);
assert.doesNotMatch(dynamic,/\.pf-advancement-fixed-art::after/,
  'Old page 2-only partial footer mask should not conflict with shared all-pages footer mask');
assert.match(dynamic,/\.pf-advancement-fixed-art > img/,
  'Right-hand equipment image must retain a fixed-aspect layer');
console.log('PF2e: all four print footers masked in live/editor without covering input fields, moving PDF art or growing page 2.');

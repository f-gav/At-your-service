import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PF2E_SIZE_OPTIONS, parseOptions, validOptions, isHeroPointId } from '../src/features/pathfinder/field-options.ts';
import { initialSheetValues, persistSheetValues } from '../src/features/pathfinder/sheet-values.ts';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
assert.deepEqual([...PF2E_SIZE_OPTIONS], ['Крошечный','Маленький','Средний','Большой','Огромный','Исполинский']);
assert.deepEqual(parseOptions(' Маленький \r\nСредний\n\n Большой '), ['Маленький','Средний','Большой']);
assert.ok(validOptions([...PF2E_SIZE_OPTIONS]));
assert.equal(validOptions([]), false);
assert.equal(validOptions(['Средний', 'Средний']), false);
assert.equal(validOptions(['  Средний  ']), false);
assert.ok(isHeroPointId('hero_1') && isHeroPointId('hero_2') && isHeroPointId('hero_3'));
assert.equal(isHeroPointId('dying'), false);
assert.equal(isHeroPointId('hero_4'), false);

// The transport format remains unchanged: select is a string, hero points are booleans.
const original = { notes: 'Сохранить', pathfinderSheet: { size:'Средний', hero_1:true, hero_2:false, schemaVersion:1 } };
const fields = initialSheetValues(original, 'Сэн');
assert.equal(fields.size, 'Средний');
assert.equal(fields.hero_1, true);
const updated = persistSheetValues(original, { ...fields, size:'Огромный', hero_2:true }, 'Сэн');
assert.equal(updated.pathfinderSheet.size, 'Огромный');
assert.equal(updated.pathfinderSheet.hero_1, true);
assert.equal(updated.pathfinderSheet.hero_2, true);
assert.ok(!Object.hasOwn(updated.pathfinderSheet, 'monochrome'));
const copy = JSON.parse(JSON.stringify({system:'Pathfinder', format:'at-your-service-character',version:1,character:{name:'Сэн',details:updated}}));
assert.equal(initialSheetValues(copy.character.details,copy.character.name).size, 'Огромный');
assert.equal(initialSheetValues(copy.character.details,copy.character.name).hero_2, true);

const schemaSource = read('../src/features/pathfinder/editor-schema.ts');
const sheetSource = read('../src/features/pathfinder/PathfinderSheet.tsx');
const adminSource = read('../src/features/pathfinder/TemplateAdmin.tsx');
const styles = read('../src/features/pathfinder/PathfinderSheet.css');
const homeSource = read('../src/App.tsx');
assert.match(schemaSource, /f.id === 'size'/);
assert.match(schemaSource, /validOptions\(a.options\)/);
assert.match(sheetSource, /field.kind === 'select'/);
assert.match(sheetSource, /const legacy = Boolean\(current\) && !options.includes\(current\)/);
assert.match(sheetSource, /pf-field-hero-toggle/);
assert.match(sheetSource, /ays-pf2e-monochrome/);
assert.match(sheetSource, /pf-monochrome/);
assert.match(adminSource, /Выпадающее меню/);
assert.match(adminSource, /parseOptions\(e.target.value\)/);
assert.match(styles, /pf-field-hero-toggle input:checked/);
assert.match(homeSource, /: 'VTM'/);
const layoutSource=read('../src/features/pathfinder/layout.ts');
const adminCss=read('../src/features/pathfinder/TemplateAdmin.css');
const siteCss=read('../src/styles.css');
assert.match(layoutSource,/underline\?: boolean;/,
  'The optional underline is a presentation setting on the template');
assert.match(schemaSource,/typeof a\.underline === 'boolean'/,
  'The template validates permanent underline as a boolean');
assert.match(adminSource,/ta-underline-setting/,
  'The admin can enable or disable the underline');
assert.match(adminSource,/f\.underline\?' ta-has-underline'/,
  'The editor previews underlining when empty');
assert.match(adminCss,/\.ta-field\.ta-has-underline::after/,
  'Editor displays the underline without a sample');
assert.match(sheetSource,/pf-field-underline/,
  'Published PF2e text fields use the persistent underline');
assert.match(styles,/\.pf-field-text\.pf-field-underline/,
  'The persistent underline survives empty input');
assert.match(styles,/left:4\.35%;top:4\.45%;width:28\.95%;height:32\.90%/,
  'Portrait is inset within the printed PF2e frame');
assert.match(homeSource,/className="character-portrait-placeholder"/,
  'Placeholder is styled independently of uploaded portraits');
assert.match(siteCss,/\.character-portrait-action img\.character-portrait-placeholder/,
  'Placeholder is enlarged and lowered within the home card');
console.log('PF2e controls: dropdowns, hero points, permanent underline, portrait framing and JSON compatibility.');

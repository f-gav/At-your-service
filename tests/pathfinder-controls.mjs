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
console.log('PF2e controls: six sizes, select options, hero points, monochrome setting, JSON v1 compatibility.');

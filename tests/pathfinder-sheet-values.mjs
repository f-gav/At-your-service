import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialSheetValues, persistSheetValues } from '../src/features/pathfinder/sheet-values.ts';

const sheetSource = readFileSync(new URL('../src/features/pathfinder/PathfinderSheet.tsx', import.meta.url), 'utf8');
const jsonSource = readFileSync(new URL('../src/lib/character-json.ts', import.meta.url), 'utf8');

const originalDetails = {
  concept: 'Странствующий музыкант',
  notes: 'Нельзя терять при сохранении',
  pathfinderSheet: {
    name: 'Старое имя',
    ancestry: 'Эльф',
    schemaVersion: 1,
    custom_new_text: 'Текст добавленного администратором поля',
    custom_new_counter: 7,
    custom_new_toggle: true,
    archived_field: 'Это поле удалено из шаблона, но его значение нужно сохранить',
    futureMetadata: { nested: 'оставить нетронутым' },
  },
};

// The admin-added IDs are absent from the shipped fields.json, but must restore correctly.
const firstOpen = initialSheetValues(originalDetails, 'Эллара');
assert.equal(firstOpen.custom_new_text, 'Текст добавленного администратором поля');
assert.equal(firstOpen.custom_new_counter, '7');
assert.equal(firstOpen.custom_new_toggle, true);
assert.equal(firstOpen.name, 'Эллара');
assert.equal(Object.hasOwn(firstOpen, 'schemaVersion'), false);

// Editing one new field must retain the rest, including values of hidden/deleted fields.
const edited = { ...firstOpen, custom_new_text: 'Исправленный тестовый текст', custom_new_counter: '8' };
const savedDetails = persistSheetValues(originalDetails, edited, 'Эллара');
assert.equal(savedDetails.pathfinderSheet.custom_new_text, 'Исправленный тестовый текст');
assert.equal(savedDetails.pathfinderSheet.custom_new_counter, '8');
assert.equal(savedDetails.pathfinderSheet.custom_new_toggle, true);
assert.equal(savedDetails.pathfinderSheet.archived_field, originalDetails.pathfinderSheet.archived_field);
assert.deepEqual(savedDetails.pathfinderSheet.futureMetadata, { nested: 'оставить нетронутым' });
assert.equal(savedDetails.pathfinderSheet.schemaVersion, 1);
assert.equal(savedDetails.notes, originalDetails.notes);

// Save -> reopen -> render through published template ID is stable.
const reopened = initialSheetValues(savedDetails, 'Эллара');
assert.equal(reopened.custom_new_text, 'Исправленный тестовый текст');
assert.equal(reopened.custom_new_counter, '8');
assert.equal(reopened.custom_new_toggle, true);
const invisibleBefore = 'archived_field';
assert.equal(reopened[invisibleBefore], originalDetails.pathfinderSheet.archived_field);

// Clearing a field must clear only that value, not others.
const cleared = persistSheetValues(savedDetails,
  { ...reopened, custom_new_text: '', custom_new_toggle: false }, 'Эллара');
assert.equal(Object.hasOwn(cleared.pathfinderSheet, 'custom_new_text'), false);
assert.equal(Object.hasOwn(cleared.pathfinderSheet, 'custom_new_toggle'), false);
assert.equal(cleared.pathfinderSheet.custom_new_counter, '8');
assert.equal(cleared.pathfinderSheet.archived_field, originalDetails.pathfinderSheet.archived_field);

// JSON v1 already serializes the entire details object, including custom fields.
const transfer = { system: 'Pathfinder', format: 'at-your-service-character', version: 1,
  character: { name: 'Эллара', details: savedDetails } };
const imported = JSON.parse(JSON.stringify(transfer));
const fromTransfer = initialSheetValues(imported.character.details, imported.character.name);
assert.equal(fromTransfer.custom_new_text, 'Исправленный тестовый текст');
assert.equal(fromTransfer.custom_new_toggle, true);
assert.equal(fromTransfer.custom_new_counter, '8');

// Guard against returning to static, fixed field enumeration.
assert.match(sheetSource, /initialSheetValues\(character\.details, character\.name\)/);
assert.match(sheetSource, /persistSheetValues\(character\.details, toStore, cleanName\)/);
assert.doesNotMatch(sheetSource, /for\s*\(const field of FIELDS\)/);
assert.match(jsonSource, /details:\s*normalizeDetails\(c\.details\)/);

console.log('PF2e: custom admin fields restore, save, clear, preserve hidden values, JSON roundtrip.');

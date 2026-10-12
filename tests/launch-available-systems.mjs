import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { systemKeys, creatableSystemKeys, canCreateCharacter } from '../src/lib/models.ts';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
assert.deepEqual([...creatableSystemKeys], ['pf2e','prmoon']);
assert.ok(canCreateCharacter('pf2e'));
assert.ok(canCreateCharacter('prmoon'));
assert.equal(canCreateCharacter('dnd5e'), false);
assert.equal(canCreateCharacter('vtm5e'), false);
assert.deepEqual(systemKeys, ['dnd5e','pf2e','vtm5e','prmoon'], 'Legacy registry stays intact');

const app = read('../src/App.tsx');
assert.ok(app.includes('creatableSystemKeys.map((system, index) => <button'));
assert.ok(app.includes('autoFocus={index === 0}'));
assert.ok(app.includes('if (!canCreateCharacter(system)) return;'));
assert.ok(app.includes('!canCreateCharacter(createPanel)'));
assert.ok(app.includes('systemKeys.map((system, index) => ('), 'Legacy system filters remain visible');
assert.ok(app.includes('parseCharacterJson'), 'Import must still work for existing characters');
console.log('PASS: launch creation only offers PF2e and Pr. Moon; old systems remain accessible');

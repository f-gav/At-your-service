import assert from 'node:assert/strict';
import {
  GAME_SYSTEMS,
  systemKeys,
  normalizedName,
  defaultDetails,
  detailString,
  normalizeDetails,
  moveCharacterToIndex,
} from '../src/lib/models.ts';

assert.deepEqual(systemKeys, ['dnd5e', 'pf2e', 'vtm5e']);
assert.equal(GAME_SYSTEMS.pf2e.edition, 'Remaster');
assert.equal(normalizedName('  Дориан  '), 'Дориан');
assert.equal(normalizedName('  ').length, 0);
assert.equal(normalizedName('x'.repeat(200)).length, 100);
assert.equal(detailString({ concept: 'Чародей' }, 'concept'), 'Чародей');
assert.equal(detailString({ unknown: 4 }, 'unknown'), '');
assert.deepEqual(normalizeDetails(null), defaultDetails());
assert.equal(normalizeDetails({ notes: 'ok', custom: { hp: 12 } }).custom.hp, 12);
const cards = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
assert.deepEqual(moveCharacterToIndex(cards, 'A', 2).map(c => c.id), ['B', 'C', 'A', 'D']);
assert.deepEqual(moveCharacterToIndex(cards, 'D', 1).map(c => c.id), ['A', 'D', 'B', 'C']);
assert.deepEqual(moveCharacterToIndex(cards, 'B', 1).map(c => c.id), ['A', 'B', 'C', 'D']);
assert.deepEqual(moveCharacterToIndex(cards, 'missing', 1).map(c => c.id), ['A', 'B', 'C', 'D']);
assert.deepEqual(cards.map(c => c.id), ['A', 'B', 'C', 'D']);
console.log('PASS: system identifiers, sanitization, draft-field helpers and card reordering');

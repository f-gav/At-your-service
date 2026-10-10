import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fields = JSON.parse(readFileSync(new URL('../src/features/pathfinder/fields.json', import.meta.url), 'utf8'));
const ids = new Set();
const perPage = [0, 0, 0, 0];
const allowed = new Set(['text', 'long', 'number', 'counter', 'toggle']);
assert.equal(fields.length, 373, 'Expected 373 mapped fields');
for (const field of fields) {
  assert.ok(typeof field.id === 'string' && field.id.length > 0);
  assert.ok(!ids.has(field.id), `Duplicate field ID: ${field.id}`);
  ids.add(field.id);
  assert.ok(field.page >= 1 && field.page <= 4, `Invalid page for ${field.id}`);
  assert.ok(allowed.has(field.kind), `Unknown kind: ${field.id}`);
  assert.ok(field.x >= 0 && field.y >= 0 && field.w > 0 && field.h > 0);
  assert.ok(field.x + field.w <= 600.945 + 0.1, `Field ${field.id} outside page width`);
  assert.ok(field.y + field.h <= 782.362 + 0.1, `Field ${field.id} outside page height`);
  if (field.min !== undefined && field.max !== undefined) {
    assert.ok(field.min <= field.max, `Invalid limits for ${field.id}`);
  }
  perPage[field.page - 1]++;
}
assert.deepEqual(perPage, [196, 57, 59, 61]);
for (const required of ['name', 'level', 'hp_current', 'hp_max', 'ability_str', 'skill_acrobatics_total', 'wealth_gp', 'campaign_notes', 'spell_slots_10']) {
  assert.ok(ids.has(required), `Missing key field: ${required}`);
}
console.log(`Pathfinder field schema OK: ${fields.length} fields across 4 pages`);

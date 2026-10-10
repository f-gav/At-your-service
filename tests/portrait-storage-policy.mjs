import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sqlFiles = [
  read('../supabase/migrations/20261010_character_portrait_private_storage.sql'),
  read('../supabase/migrations/20261010_fix_character_portrait_rls.sql'),
];
for (const sql of sqlFiles) {
  assert.equal((sql.match(/create policy "Portrait /g)||[]).length, 3,
    'Policies must cover upload, download and deletion');
  assert.equal((sql.match(/storage\.foldername\(storage\.objects\.name\)/g)||[]).length, 6,
    'All user and character path checks must refer to storage.objects.name explicitly');
  assert.match(sql,/storage\.filename\(storage\.objects\.name\)/);
  assert.doesNotMatch(sql,/storage\.foldername\(name\)|storage\.filename\(name\)/,
    'An unqualified name is shadowed by characters.name within EXISTS');
  assert.match(sql,/c\.user_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(sql,/c\.id::text\s*=\s*\(storage\.foldername\(storage\.objects\.name\)\)\[2\]/);
}
console.log('Storage policies: owner-only paths are unambiguously matched to object names.');

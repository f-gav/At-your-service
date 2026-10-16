import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  GAME_SYSTEMS,
  systemKeys,
  normalizedName,
  defaultDetails,
  detailString,
  normalizeDetails,
  moveCharacterToIndex,
} from '../src/lib/models.ts';

assert.deepEqual(systemKeys, ['dnd5e', 'pf2e', 'vtm5e', 'prmoon']);
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


// Release 0.2 static guards. These verify repository policy definitions,
// not the live Supabase installation (which requires separate account tests).
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const schema=read('../supabase/schema.sql');
const admins=read('../supabase/migrations/20261010_template_admin_editor.sql');
const portraits=read('../supabase/migrations/20261010_one_source_portrait_with_crop_frames.sql');
const ownerPortraits=read('../supabase/migrations/20261010_fix_character_portrait_rls.sql');
const json=read('../src/lib/character-json.ts');
const systems=read('../src/lib/models.ts');
assert.ok(schema.includes('alter table public.characters enable row level security'));
for(const operation of ['select','insert','update','delete']){
  assert.ok(schema.includes('characters_'+operation+'_own'),
    'Character RLS policy missing: '+operation);
}
assert.ok(schema.includes('with check ((select auth.uid()) = user_id)'),
  'Character inserts/updates require ownership');
assert.ok(admins.includes('alter table public.sheet_admins enable row level security'));
for(const table of ['sheet_templates','sheet_template_drafts','sheet_template_history']){
  assert.ok(admins.includes('alter table public.'+table+' enable row level security'),
    'Admin table RLS must be enabled: '+table);
}
assert.ok(admins.includes('security invoker')&&admins.includes('public.sheet_admins'),
  'Template publishing requires server-authorized admin privileges');
assert.ok(ownerPortraits.includes('storage.foldername(storage.objects.name)'),
  'Portrait policies must use the Storage object path, not the character name');
assert.ok(portraits.includes('source[.]webp'),
  'Current portrait upload rules must permit single optimized source assets');
assert.ok(json.includes("data.version !== 1"),
  'Unknown character JSON versions must be rejected');
assert.ok(json.includes('JSON слишком большой')&&json.includes('normalizeDetails(data.character.details)'),
  'Character JSON must enforce size limits and normalize incoming details');
assert.ok(systems.includes("creatableSystemKeys = ['pf2e', 'prmoon']"),
  'Unreleased systems must not be available for new characters');
const integrity=read('../supabase/backup-integrity.sql');
const restoreRunbook=read('../docs/BACKUP-RESTORE-RU.md');
for(const table of ['characters','sheet_admins','sheet_templates','sheet_template_drafts','sheet_template_history']){
  assert.ok(integrity.includes('public.'+table),'Backup integrity inventory misses '+table);
}
assert.ok(integrity.includes("bucket_id='character-portraits'"));
assert.ok(integrity.includes('missing_source_objects')&&integrity.includes('unreferenced_portrait_objects'));
const sqlOnly=integrity.replace(/--[^\n]*/g,'');
assert.doesNotMatch(sqlOnly,/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE)\b/i,
  'Backup integrity check must remain read-only');
assert.ok(restoreRunbook.includes('изолированный')&&restoreRunbook.includes('Storage')&&restoreRunbook.includes('pg_dump'),
  'Backup documentation must require separate Storage copies and isolated restoration');
console.log('PASS: v0.2 backup-integrity SQL stays read-only and covers characters, templates, history and portraits');

const securityAudit=read('../supabase/security-audit.sql');
const sqlWithoutComments=securityAudit.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
assert.doesNotMatch(sqlWithoutComments,/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO)\b/i,
  'Security audit SQL must never write to the live database');
for(const check of ['pg_policies','pg_roles','prosecdef','character-portraits','publish_sheet_template']){
  assert.ok(securityAudit.includes(check),'Security inventory missing '+check);
}
const appSecurity=read('../src/App.tsx');
assert.match(appSecurity,/setIsTemplateAdmin\(false\);\s*setShowTemplateAdmin\(false\);\s*if\(!supabase\|\|!user\?\.id\)return;/,
  'Switching users must immediately revoke stale template admin UI privileges');
console.log('PASS: live security inventory remains read-only and admin controls reset on account switch');

console.log('PASS: v0.2 static SQL/RLS, private portrait, JSON v1 and system availability guards');

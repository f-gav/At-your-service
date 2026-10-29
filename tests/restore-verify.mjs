import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {readFileSync} from 'node:fs';
import {compareBackupRestore} from '../scripts/verify-restore.mjs';

const countKeys=['characters','admins','published_templates','template_drafts',
  'template_versions','portrait_objects','new_portrait_references',
  'legacy_portrait_references','game_rooms','room_members','room_rolls'];
const integrityKeys=['missing_source_objects','missing_card_objects','missing_sheet_objects',
  'unreferenced_portrait_objects','versions_with_missing_template',
  'invalid_room_memberships','broken_room_roll_links',
  'malformed_member_snapshots','malformed_roll_dice'];
const counts=Object.fromEntries(countKeys.map(k=>[k,k==='portrait_objects'?1:2]));
const integrity=Object.fromEntries(integrityKeys.map(k=>[k,0]));
const fixture={counts,integrity};
const temp=await mkdtemp(path.join(os.tmpdir(),'ays-restore-test-'));
const src=path.join(temp,'source'),dst=path.join(temp,'restored');
try{
  await Promise.all([mkdir(path.join(src,'private')),mkdir(path.join(dst,'private'))]);
  await Promise.all([
    writeFile(path.join(src,'private','portrait.webp'),'synthetic test bytes'),
    writeFile(path.join(dst,'private','portrait.webp'),'synthetic test bytes'),
  ]);
  const done=await compareBackupRestore(fixture,structuredClone(fixture),src,dst);
  assert.equal(done.files,1);
  assert.equal(done.integrityChecks,9);
  await writeFile(path.join(dst,'private','portrait.webp'),'changed content');
  await assert.rejects(compareBackupRestore(fixture,fixture,src,dst),/Storage contents differ/);
  await writeFile(path.join(dst,'private','portrait.webp'),'synthetic test bytes');
  await assert.rejects(compareBackupRestore(fixture,
    {...fixture,counts:{...counts,room_rolls:999}},src,dst),/Different row counts: room_rolls/);
  await assert.rejects(compareBackupRestore(fixture,
    {...fixture,integrity:{...integrity,broken_room_roll_links:1}},src,dst),
    /Restore integrity violation: broken_room_roll_links/);
  await assert.rejects(compareBackupRestore(
    {...fixture,counts:{...counts,portrait_objects:2}},fixture,src,dst),
    /Source Storage file count differs/);
}finally{await rm(temp,{recursive:true,force:true});}

const e2e=readFileSync(new URL('../scripts/security-two-accounts-e2e.mjs',import.meta.url),'utf8');
assert.ok(e2e.includes('AYS_E2E_OWNER_JWT')&&e2e.includes('AYS_E2E_OUTSIDER_JWT'));
assert.ok(e2e.includes('/auth/v1/user'));
assert.ok(e2e.includes("owner.data.id,outsider.data.id"));
assert.ok(e2e.includes('AYS_E2E_ISOLATED_RESTORE'));
assert.ok(e2e.includes('cvimyqmksxeigjnofexf.supabase.co'));
assert.ok(e2e.includes("await response.body?.cancel()"));
assert.ok(e2e.includes('SKIP: RPC POST tests require isolated restored Supabase'));
console.log('PASS: offline DB+Storage restore comparison and two-JWT test safety guards');

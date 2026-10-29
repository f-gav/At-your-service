#!/usr/bin/env node
/**
 * Compare independently collected DB integrity inventories AND the exact
 * bytes of private Storage files in a source backup and isolated restore.
 * Never downloads or modifies production; does not print sensitive paths.
 *
 * Usage: node scripts/verify-restore.mjs source.json restore.json source-dir restore-dir
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const countKeys=['characters','admins','published_templates','template_drafts',
  'template_versions','portrait_objects','new_portrait_references',
  'legacy_portrait_references','game_rooms','room_members','room_rolls'];
const fingerprintTables=['characters','sheet_admins','sheet_templates','sheet_template_drafts',
  'sheet_template_history','game_rooms','game_room_members','game_room_rolls'];
const integrityKeys=['missing_source_objects','missing_card_objects','missing_sheet_objects',
  'unreferenced_portrait_objects','versions_with_missing_template',
  'invalid_room_memberships','broken_room_roll_links',
  'malformed_member_snapshots','malformed_roll_dice'];

export function validateInventory(value){
  assert.ok(value && typeof value==='object' && !Array.isArray(value),
    'Inventory must be an object');
  for(const section of ['counts','integrity']){
    assert.ok(value[section] && typeof value[section]==='object',
      'Missing '+section+' inventory section');
  }
  for(const field of countKeys){
    assert.ok(Number.isSafeInteger(value.counts[field]) && value.counts[field]>=0,
      'Invalid count '+field);
  }
  for(const field of integrityKeys){
    assert.equal(value.integrity[field],0,'Restore integrity violation: '+field);
  }
  assert.ok(value.fingerprints && typeof value.fingerprints==='object',
    'Missing row fingerprints (run supabase/restore-row-fingerprints.sql)');
  for(const table of fingerprintTables){
    assert.match(value.fingerprints[table]??'',/^[a-f0-9]{64}$/,
      'Missing or malformed row hash: '+table);
  }
}

async function hashFile(file){
  const hash=createHash('sha256');
  let size=0;
  for await(const chunk of createReadStream(file)){
    hash.update(chunk);
    size+=chunk.length;
  }
  return {sha256:hash.digest('hex'),size};
}

async function digestTree(root){
  const files=new Map();
  async function visit(dir,relative){
    const entries=await readdir(dir,{withFileTypes:true});
    for(const entry of entries){
      assert.ok(!entry.isSymbolicLink(),'Storage backup cannot contain symlinks');
      const rel=path.posix.join(relative,entry.name);
      const absolute=path.join(dir,entry.name);
      if(entry.isDirectory())await visit(absolute,rel);
      else if(entry.isFile())files.set(rel,await hashFile(absolute));
      else throw Error('Unsupported file in Storage export');
    }
  }
  await visit(root,'');
  return files;
}

export async function compareBackupRestore(source,restored,sourceDir,restoreDir){
  validateInventory(source);
  validateInventory(restored);
  for(const field of countKeys){
    assert.equal(restored.counts[field],source.counts[field],
      'Different row counts: '+field);
  }
  for(const table of fingerprintTables){
    assert.equal(restored.fingerprints[table],source.fingerprints[table],
      'Different restored row contents: '+table);
  }
  const a=await digestTree(sourceDir);
  const b=await digestTree(restoreDir);
  assert.equal(a.size,source.counts.portrait_objects,
    'Source Storage file count differs from DB object metadata');
  assert.equal(b.size,restored.counts.portrait_objects,
    'Restored Storage file count differs from DB object metadata');
  assert.deepEqual([...a.keys()].sort(),[...b.keys()].sort(),
    'Source and restored Storage paths differ');
  for(const [rel,fingerprint] of a){
    assert.deepEqual(b.get(rel),fingerprint,'Storage contents differ');
  }
  return {tables:countKeys.length,files:a.size,integrityChecks:integrityKeys.length};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==6){
    console.error('Usage: node scripts/verify-restore.mjs SOURCE_JSON RESTORED_JSON SOURCE_STORAGE_DIR RESTORED_STORAGE_DIR');
    process.exitCode=2;
  }else{
    try{
      const [srcManifest,dstManifest,srcStorage,dstStorage]=process.argv.slice(2);
      const [source,restored]=await Promise.all([
        readFile(srcManifest,'utf8').then(JSON.parse),
        readFile(dstManifest,'utf8').then(JSON.parse),
      ]);
      const result=await compareBackupRestore(source,restored,srcStorage,dstStorage);
      console.log('PASS: matched '+result.tables+' DB counts, '+result.integrityChecks+
        ' integrity checks, and '+result.files+' private Storage object SHA-256 hashes');
      console.log('NOTE: also test application Auth/JSON/PDF and review DB schema/migrations in the isolated restore.');
    }catch(err){
      console.error('FAIL: restore inventory does not match; see '+(err?.message??'verification error'));
      process.exitCode=1;
    }
  }
}

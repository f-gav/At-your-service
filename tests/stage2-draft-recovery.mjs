import assert from 'node:assert/strict';
import {characterDraftKey,recoverLocalDraft,writeLocalDraft,clearLocalDraft,conflictingLocalDrafts}
  from '../src/lib/local-drafts.ts';
import {readFileSync} from 'node:fs';

function localStorageFixture(){
  const values=new Map();
  let fail=false;
  return {
    get length(){return values.size;},
    key(index){return [...values.keys()][index]??null;},
    getItem(key){return values.get(key)??null;},
    setItem(key,value){if(fail)throw Error('QuotaExceededError');values.set(key,value);},
    removeItem(key){values.delete(key);},
    values,
    denyWrites(next){fail=next;},
  };
}
const storage=localStorageFixture();
globalThis.window={localStorage:storage};
const key=characterDraftKey('account-A','character-PF');
const baseline='{"name":"Граций","hp":11}',update='{"name":"Граций","hp":12}';
assert.equal(writeLocalDraft(key,baseline,update,'tab-one'),true);
assert.equal(recoverLocalDraft(key,baseline),update);
assert.equal(conflictingLocalDrafts(key,baseline).length,0);
assert.equal(writeLocalDraft(key,baseline,'{"name":"Граций","hp":13}','tab-one'),true);
assert.equal(conflictingLocalDrafts(key,baseline).length,0,'same-tab typing must not flood archive');
const latest='{"name":"Граций","hp":13}';
assert.equal(writeLocalDraft(key,baseline,'{"name":"Граций","hp":18}','tab-two'),true);
assert.equal(recoverLocalDraft(key,baseline),'{"name":"Граций","hp":18}');
assert.ok(conflictingLocalDrafts(key,'{"name":"Граций","hp":14}').some(d=>d.snapshot===latest),
  'a second tab must preserve the prior tab edit before replacing it');

const newCloud='{"name":"Граций","hp":25}';
assert.equal(recoverLocalDraft(key,newCloud),null,'never apply a stale base to a newer cloud character');
assert.ok(conflictingLocalDrafts(key,newCloud).length>=2,
  'stale device work must remain available for manual export');
assert.equal(writeLocalDraft(key,newCloud,'{"name":"Граций","hp":26}','tab-two'),true);
assert.equal(recoverLocalDraft(key,newCloud),'{"name":"Граций","hp":26}');
const backups=conflictingLocalDrafts(key,newCloud);
assert.ok(backups.some(d=>d.snapshot==='{"name":"Граций","hp":18}'),
  'editing a newer cloud version must archive the old unsaved snapshot');
const before=storage.values.size;
writeLocalDraft(key,newCloud,'{"name":"Граций","hp":27}','tab-two');
assert.equal(storage.values.size,before,'normal typing in one tab should not archive each keystroke');
clearLocalDraft(key,'{"name":"Граций","hp":25}');
assert.equal(recoverLocalDraft(key,newCloud),'{"name":"Граций","hp":27}',
  'acknowledging older cloud data must not clear pending edits');
clearLocalDraft(key,'{"name":"Граций","hp":27}');
assert.equal(recoverLocalDraft(key,newCloud),null);
assert.ok(conflictingLocalDrafts(key,newCloud).length>0,'successful save must not erase conflict archive');

// If browser storage is denied, never throw or delete the existing draft.
writeLocalDraft(key,baseline,update,'tab-one');
const oldRaw=storage.getItem(key);
storage.denyWrites(true);
assert.equal(writeLocalDraft(key,newCloud,'{"name":"Граций","hp":29}','tab-two'),false);
assert.equal(storage.getItem(key),oldRaw,'no clobber when preservation fails');
storage.denyWrites(false);

// Stale/corrupt records must be ignored and expired archives cleaned.
const archives=[...storage.values.keys()].filter(k=>k.startsWith(key+':archive:'));
assert.ok(archives.length>0);
for(const archiveKey of archives){
  const item=JSON.parse(storage.getItem(archiveKey));
  storage.setItem(archiveKey,JSON.stringify({...item,updatedAt:Date.now()-16*86400000}));
}
conflictingLocalDrafts(key,newCloud);
assert.ok(![...storage.values.keys()].some(k=>k.startsWith(key+':archive:')),
  'recovery backups older than retention period must expire');

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const pf=readFileSync(new URL('../src/features/pathfinder/PathfinderSheet.tsx',import.meta.url),'utf8');
const moon=readFileSync(new URL('../src/features/project-moon/ProjectMoonSheet.tsx',import.meta.url),'utf8');
for(const [name,source] of [['generic',app],['Pathfinder',pf],['Project Moon',moon]]){
  assert.match(source,/<DeviceDraftNotice draftKey=\{draftKey\} cloudSnapshot=\{serverBaseline\}/,
    name+' must offer stale draft download');
  assert.match(source,/auto\.localWarning/,name+' must warn on blocked device storage');
}
assert.match(app,/characterLoadError/, 'failed character list must have distinct state');
assert.match(app,/Повторить загрузку/,'character list must have a retry action');
console.log('PASS: local draft recovery/archive, multiple writers, stale cloud, denied storage and all sheet warnings');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saveCharacterIfCurrent,sameEditableContent,StaleCharacterError} from '../src/lib/character-save.ts';

const initial={name:'Граций',details:{notes:'A',pathfinderSheet:{hp:14,ac:18}},updated_at:'r1'};
assert.equal(sameEditableContent(initial,{name:'Граций',details:{pathfinderSheet:{ac:18,hp:14},notes:'A'}}),true,
  'JSONB object key ordering is not an edit');
assert.equal(sameEditableContent(initial,{name:'Граций',details:{notes:'B',pathfinderSheet:{hp:14,ac:18}}}),false);

function backend(start=initial){
  let row=structuredClone(start);
  const revisions=[];
  return {
    get:()=>structuredClone(row),
    external:patch=>{row={...row,...patch};},
    revisions,
    update:async revision=>{
      revisions.push(revision);
      if(revision!==row.updated_at)return {data:null,error:null};
      row={...row,name:'Граций',details:{notes:'MY EDIT'},updated_at:'written'};
      return {data:structuredClone(row),error:null};
    },
    read:async()=>({data:structuredClone(row),error:null}),
  };
}

let db=backend();
assert.equal((await saveCharacterIfCurrent(initial,db.update,db.read)).updated_at,'written');
assert.deepEqual(db.revisions,['r1'],'normal save should use one guarded write');

db=backend({...initial,updated_at:'r2'}); // portrait or ordering touched only metadata
assert.equal((await saveCharacterIfCurrent(initial,db.update,db.read)).updated_at,'written');
assert.deepEqual(db.revisions,['r1','r2'],'metadata-only revision should retry once');

db=backend({...initial,updated_at:'r2',details:{notes:'FROM ANOTHER DEVICE'}});
await assert.rejects(saveCharacterIfCurrent(initial,db.update,db.read),StaleCharacterError,
  'remote content changes may not be overwritten');
assert.deepEqual(db.revisions,['r1'],'do not retry when content changed');
assert.equal(db.get().details.notes,'FROM ANOTHER DEVICE');

db=backend({...initial,updated_at:'r2'});
const raceRead=async()=>{
  const snapshot=await db.read();
  db.external({updated_at:'r3',details:{notes:'NEWER'}});
  return snapshot;
};
await assert.rejects(saveCharacterIfCurrent(initial,db.update,raceRead),StaleCharacterError,
  'a race after metadata-only read must fail closed');
assert.equal(db.get().details.notes,'NEWER');

await assert.rejects(saveCharacterIfCurrent(initial,
  async()=>({data:null,error:{message:'network rejected'}}),
  async()=>({data:initial,error:null})),/network rejected/);
await assert.rejects(saveCharacterIfCurrent(initial,
  async()=>({data:null,error:null}),
  async()=>({data:null,error:{message:'read forbidden'}})),/read forbidden/);

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
assert.ok(app.includes('.eq(\'updated_at\',revision)'),'character writes must be atomic CAS updates');
assert.ok(app.includes('saveCharacterIfCurrent('),'all character sheets must use the guarded save');
assert.ok(app.includes('throw cause;'),'conflict must reach the autosave error state');
console.log('PASS: character concurrency guard: normal, metadata-only, stale, race and error paths');

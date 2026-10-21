import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCachedSpellCatalogLoader} from '../src/features/spell-library/cached-catalog.ts';
import {parseSpellCatalog,toSpellViews} from '../src/features/spell-library/catalog.ts';
import {
  filterGrimoireEntries,groupGrimoireEntries,summarizeGrimoire,
} from '../src/features/pathfinder/grimoire-selectors.ts';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const base=parseSpellCatalog(read('../public/spell-library/pf2e.json'),'pf2e');
const necro=parseSpellCatalog(read('../public/spell-library/pf2e-necromancer.json'),'pf2e');
const sample=()=>structuredClone(base);
const signal=()=>new AbortController().signal;

// Opening the library and then the grimoire must reuse the same in-memory data.
let requests=0;
const cached=createCachedSpellCatalogLoader(async()=>{
  requests++;
  return sample();
});
const first=await cached('pf2e',signal(),'/At-your-service/');
const second=await cached('pf2e',signal(),'/At-your-service/');
assert.equal(requests,1,'Reopening a catalog must not repeat the network load');
assert.notStrictEqual(first,second,'Consumers must receive independent objects');
first.spells.length=0;
assert.equal(second.spells.length,base.spells.length,'Mutations must not poison shared cache');
await cached('pf2e',signal(),'/other/');
await cached('dnd5e',signal(),'/At-your-service/');
assert.equal(requests,3,'Separate systems and base paths must be isolated');

// Simultaneous callers deduplicate the request, but can cancel independently.
let finishLoad;
let simultaneousRequests=0;
const gate=new Promise(resolve=>{finishLoad=resolve;});
const shared=createCachedSpellCatalogLoader(async(_system,underlyingSignal)=>{
  simultaneousRequests++;
  await gate;
  if(underlyingSignal.aborted)throw new DOMException('Cancelled','AbortError');
  return sample();
});
const a=new AbortController();
const b=new AbortController();
const aborted=shared('pf2e',a.signal,'/');
const successful=shared('pf2e',b.signal,'/');
await Promise.resolve(); // Let the shared fetch start.
a.abort();
await assert.rejects(aborted,{name:'AbortError'});
finishLoad();
assert.equal((await successful).spells.length,base.spells.length);
assert.equal(simultaneousRequests,1,'Concurrent callers must share one fetch');

// With no subscribers left, the underlying fetch must be aborted and evicted.
let lastUnderlying;
let starts=0;
const cancelledCache=createCachedSpellCatalogLoader(async(_system,underlyingSignal)=>{
  starts++;
  lastUnderlying=underlyingSignal;
  await new Promise((_,reject)=>{
    if(underlyingSignal.aborted)reject(new DOMException('Cancelled','AbortError'));
    else underlyingSignal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
  });
  return sample();
});
const c=new AbortController();
const pending=cancelledCache('pf2e',c.signal,'/');
await Promise.resolve();
c.abort();
await assert.rejects(pending,{name:'AbortError'});
assert.equal(lastUnderlying?.aborted,true,'Last cancellation must stop the fetch');
const d=new AbortController();
const again=cancelledCache('pf2e',d.signal,'/');
await Promise.resolve();
assert.equal(starts,2,'Cancelled request cannot be returned from cache');
d.abort();
await assert.rejects(again,{name:'AbortError'});

// Failure must not get cached; retry must work.
let attempts=0;
const retryable=createCachedSpellCatalogLoader(async()=>{
  attempts++;
  if(attempts===1)throw new Error('Temporary network error');
  return sample();
});
await assert.rejects(()=>retryable('pf2e',signal(),'/'),/Temporary network error/);
assert.equal((await retryable('pf2e',signal(),'/')).spells.length,base.spells.length);
assert.equal(attempts,2);

// Grimoire filters and summaries must retain the old user-visible semantics.
const necroViews=toSpellViews(necro,'pf2e-remaster');
const baseSpell=toSpellViews(base,'pf2e-remaster').find(x=>x.spell.kind==='spell'&&x.spell.rank===1);
assert.ok(baseSpell,'An ordinary rank-one spell must exist');
const cantrip=necroViews.find(x=>x.spell.kind==='cantrip');
const focus=necroViews.find(x=>x.spell.kind==='focus');
assert.ok(cantrip&&focus);
const entries=[baseSpell,cantrip,focus];
const selection=[
  {id:baseSpell.id,prepared:true},
  {id:cantrip.id,prepared:true},
  {id:focus.id,prepared:true},
  {id:'missing-spell',prepared:false},
];
const selected=new Map(selection.map(x=>[x.id,x]));
assert.equal(filterGrimoireEntries(entries,0,'all','',selected).length,1,
  'Rank-one necromancer cantrips must be shown in Cantrips');
assert.equal(filterGrimoireEntries(entries,1,'all','',selected).length,2);
assert.equal(filterGrimoireEntries(entries,'all','prepared','',selected).length,3);
assert.deepEqual(filterGrimoireEntries(entries,'all','all',baseSpell.name.toUpperCase(),selected).map(x=>x.id),[baseSpell.id]);
const groups=groupGrimoireEntries(entries);
assert.equal(groups.length,11);
assert.deepEqual(groups[0].map(x=>x.id),[cantrip.id]);
assert.deepEqual(groups[1].map(x=>x.id),[baseSpell.id,focus.id]);
const summary=summarizeGrimoire(entries,selection,[0]);
assert.equal(summary.selectedCount,3,'All selected kinds count toward the marked total');
assert.equal(summary.preparedCount,1,'Only ordinary prepared spells count against slots');
assert.deepEqual(summary.slotWarnings,['1-й круг: 1 из 0']);
assert.deepEqual(summarizeGrimoire(entries,selection,[]).slotWarnings,[],
  'Missing slot configuration must not be interpreted as zero slots');
console.log('PASS: shared cache lifecycle, cancellation, retry, grimoire filters and rank summaries');

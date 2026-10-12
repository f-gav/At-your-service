import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {
  characterDraftKey,recoverLocalDraft,writeLocalDraft,clearLocalDraft,
} from '../src/lib/local-drafts.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const pf=read('../src/features/pathfinder/PathfinderSheet.tsx');
const moon=read('../src/features/project-moon/ProjectMoonSheet.tsx');
const app=read('../src/App.tsx');
const auto=read('../src/lib/use-auto-save.ts');
const status=read('../src/lib/AutoSaveStatus.tsx');
const index=read('../index.html');
const sw=read('../public/sw.js');
const manifest=JSON.parse(read('../public/manifest.webmanifest'));
const main=read('../src/main.tsx');
const register=read('../src/lib/register-service-worker.ts');

for(const sheet of [pf,moon,app]) {
  assert.ok(sheet.includes('useAutoSave('),'All existing character editors use autosave');
  assert.ok(sheet.includes('AutoSaveStatus'),'Every editor shows cloud save status');
  assert.ok(sheet.includes('await auto.saveNow()'),'Going back flushes pending changes');
}
for(const sheet of [pf,moon]) {
  assert.ok(!sheet.includes('> Сохранить</button>'),'Remove old full-size Save buttons');
  assert.ok(sheet.includes('snapshot:JSON.stringify('));
  assert.ok(sheet.includes('recoverLocalDraft('));
  assert.ok(sheet.includes('const editLocked='),'Do not lock fields during background save');
}
assert.ok(auto.includes('inFlight.current'),'Network writes must be serialized');
assert.ok(auto.includes('savedRef.current=payload'),'Only acknowledge exact saved payload');
assert.ok(auto.includes('setFailedSnapshot(payload)'),'Failure must be visible and not silently retried forever');
assert.ok(auto.includes('writeLocalDraft(draftKey,payload,currentRef.current)'));
assert.ok(auto.includes("window.addEventListener('beforeunload'"));
assert.ok(auto.includes("window.addEventListener('online'"));
assert.ok(auto.includes("document.addEventListener('visibilitychange'"));
assert.ok(auto.includes('if(!ok)'),'Server failure cannot be called a success');
assert.ok(status.includes('Повторить'));
assert.ok(app.includes('usePwaInstall()'));
assert.ok(app.includes('Установить приложение'));

const storage=new Map();
globalThis.window={
  localStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,value),
    removeItem:key=>storage.delete(key),
  },
};
const key=characterDraftKey('user-A','sheet-B');
const baseline='{"a":1}',later='{"a":2}',elsewhere='{"a":3}';
writeLocalDraft(key,baseline,later);
assert.equal(recoverLocalDraft(key,baseline),later);
assert.equal(recoverLocalDraft(key,elsewhere),null,'Draft from stale base must never overwrite newer cloud data');
writeLocalDraft(key,baseline,baseline);
assert.equal(recoverLocalDraft(key,baseline),null);
writeLocalDraft(key,baseline,later);
clearLocalDraft(key);
assert.equal(recoverLocalDraft(key,baseline),null);
writeLocalDraft(key,baseline,later);
const stale=JSON.parse(storage.get(key));
stale.updatedAt=Date.now()-15*24*60*60*1000;
storage.set(key,JSON.stringify(stale));
assert.equal(recoverLocalDraft(key,baseline),null,'Expired device drafts are ignored');

assert.ok(index.includes('rel="manifest"'));
assert.ok(index.includes('%BASE_URL%manifest.webmanifest'));
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons.some(x=>x.sizes==='192x192'&&x.purpose==='any'));
assert.ok(manifest.icons.some(x=>x.sizes==='512x512'&&x.purpose==='any'));
assert.ok(manifest.icons.some(x=>x.sizes==='512x512'&&x.purpose==='maskable'));
assert.ok(main.includes('registerServiceWorker()'));
assert.ok(register.includes('import.meta.env.BASE_URL'));
assert.ok(sw.includes("if(req.method!=='GET')return;"));
assert.ok(sw.includes("if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;"));
assert.ok(sw.includes("req.mode==='navigate'"));
assert.ok(!sw.includes('supabase.co')&&!sw.includes('auth.getSession'));
assert.ok(sw.includes("const isPublicAsset="));
assert.ok(!sw.includes("localStorage"),'No personal character data in service worker');

execFileSync(process.execPath,[new URL('../scripts/generate-pwa-icons.mjs',import.meta.url).pathname]);
for(const name of ['pwa-icon-192.png','pwa-icon-512.png','pwa-icon-maskable-512.png']){
  const png=PNG.sync.read(readFileSync(new URL('../public/'+name,import.meta.url)));
  const expected=name.includes('192')?192:512;
  assert.equal(png.width,expected,name+' width');
  assert.equal(png.height,expected,name+' height');
}
console.log('PASS: auto-save sequencing hooks, local recovery, retry, PWA install, scoped service worker and icon generation');

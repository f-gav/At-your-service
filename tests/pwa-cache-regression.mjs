import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the real service worker inside a minimal worker runtime.
// This test protects offline public assets without caching OAuth and user data.
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const scope='https://example.test/At-your-service/';
const listeners=new Map();
const cached=new Map();
let offline=false, fetches=0;
const cache={
  async addAll(items){for(const item of items)cached.set(item,{ok:true,type:'basic',clone(){return this;}});},
  async put(req,response){cached.set(typeof req==='string'?req:req.url,response);},
};
const caches={
  async open(){return cache;},
  async keys(){return ['ays-shell-v3'];},
  async delete(){return true;},
  async match(req){return cached.get(typeof req==='string'?req:req.url);},
};
const self={
  registration:{scope},
  location:{origin:'https://example.test'},
  addEventListener:(event,listener)=>listeners.set(event,listener),
  skipWaiting:async()=>{},
  clients:{claim:async()=>{}},
};
const fetch=async(req)=>{
  fetches++;
  if(offline)throw Error('offline');
  return {ok:true,type:'basic',clone(){return this;}};
};
vm.runInNewContext(source,{self,caches,fetch,URL,Response:{error:()=>({offlineError:true})}});
assert.ok(listeners.has('fetch'));
async function request(url,mode='no-cors'){
  let promise;
  const event={request:{url,mode,method:'GET'},respondWith:value=>{promise=value;}};
  listeners.get('fetch')(event);
  return promise?await promise:null;
}
const js=scope+'assets/main-123.js';
const css=scope+'assets/main-123.css';
const image=scope+'pwa-icon-192.png';
for(const uri of [js,css,image]) {
  assert.ok(await request(uri),'Online static request should be intercepted');
  assert.ok(cached.has(uri),'Worker must cache public asset: '+uri);
}
offline=true;
for(const uri of [js,css,image]) {
  const response=await request(uri);
  assert.ok(response&&response.ok,'Previously cached asset must work offline: '+uri);
}
const countBefore=cached.size;
for(const uri of [
  'https://backend.supabase.co/rest/v1/characters',
  scope+'api/characters',
  scope+'private-data.json',
  scope+'?code=oauth-temporary-code'
]){
  const mode=uri.includes('?code=')?'navigate':'no-cors';
  await request(uri,mode);
}
assert.equal(cached.size,countBefore,'Private/OAuth requests must never create new cached entries');
assert.ok(![...cached.keys()].some(url=>url.includes('code=')||url.includes('supabase.co')||url.includes('private-data')));
assert.ok(fetches>=3);
console.log('PASS: actual service worker caches public JS/CSS/images, restores them offline and does not cache private/API/OAuth URLs');

/* At your service! — installable app shell, not an offline character editor.
 * Only same-origin PUBLIC assets are cached. Supabase sessions, API responses,
 * private portraits, JSON character data and OAuth callbacks are NEVER cached.
 */
const CACHE_NAME='ays-shell-v2';
const SCOPE=self.registration.scope;
const CORE=[
  SCOPE,
  new URL('manifest.webmanifest',SCOPE).toString(),
  new URL('site-icon.png',SCOPE).toString(),
  new URL('pwa-icon-192.png',SCOPE).toString(),
  new URL('pwa-icon-512.png',SCOPE).toString(),
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith('ays-shell-')&&key!==CACHE_NAME)
    .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
  if(req.mode==='navigate') {
    // Never store the requested URL: OAuth query codes and sessions may appear.
    // Always try the network first; an offline shell cannot access cloud data.
    event.respondWith(fetch(req).then(response=>{
      if(response.ok&&response.type==='basic'&&url.pathname===new URL(SCOPE).pathname) {
        const copy=response.clone();
        void caches.open(CACHE_NAME).then(cache=>cache.put(SCOPE,copy));
      }
      return response;
    }).catch(async()=>{
      const cached=await caches.match(SCOPE);
      return cached||Response.error();
    }));
    return;
  }
  // Updated assets must be fetched from the network first. Previous versions
  // used cache-first and could retain obsolete styles across deployments.
  const isPublicAsset=/\\.(?:js|css|png|svg|webp|woff2?|ttf|ico|pdf)$/.test(url.pathname);
  if(!isPublicAsset)return;
  event.respondWith((async()=>{
    try {
      const response=await fetch(req);
      if(response.ok&&response.type==='basic') {
        const cache=await caches.open(CACHE_NAME);
        await cache.put(req,response.clone());
      }
      return response;
    }catch{
      return (await caches.match(req))||Response.error();
    }
  })());
});

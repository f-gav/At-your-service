import {loadSpellCatalog} from './load-catalog.ts';
import type {SpellCatalog,SpellSystem} from './catalog';

type CatalogFetcher=(system:SpellSystem,signal:AbortSignal,basePath:string)=>Promise<SpellCatalog>;
type PendingLoad={
  controller:AbortController;
  promise:Promise<SpellCatalog>;
  listeners:number;
  settled:boolean;
};

/**
 * A short-lived, in-memory catalog cache shared by the Library and Grimoire.
 * No character data is stored. Concurrent callers share one fetch, but each
 * caller may cancel independently. The last cancellation aborts the fetch.
 * Return independent copies because some consumers sort or modify catalogs.
 * Errors and cancelled requests never become cached results.
 */
export function createCachedSpellCatalogLoader(fetchCatalog:CatalogFetcher=loadSpellCatalog):CatalogFetcher{
  const loaded=new Map<string,SpellCatalog>();
  const pending=new Map<string,PendingLoad>();

  return async (system,signal,basePath)=>{
    if(signal.aborted)throw new DOMException('Загрузка отменена','AbortError');
    const key=basePath.replace(/\/?$/, '/')+'|'+system;
    const cached=loaded.get(key);
    if(cached)return structuredClone(cached);

    let request=pending.get(key);
    if(!request){
      const controller=new AbortController();
      const entry:PendingLoad={controller,promise:null as unknown as Promise<SpellCatalog>,listeners:0,settled:false};
      entry.promise=Promise.resolve().then(()=>fetchCatalog(system,controller.signal,basePath))
        .then(data=>{
          if(!controller.signal.aborted)loaded.set(key,data);
          return data;
        }).finally(()=>{
          entry.settled=true;
          if(pending.get(key)===entry)pending.delete(key);
        });
      request=entry;
      pending.set(key,entry);
    }
    const flight=request;
    flight.listeners++;
    return new Promise<SpellCatalog>((resolve,reject)=>{
      let subscribed=true;
      const finish=()=>{
        if(!subscribed)return;
        subscribed=false;
        signal.removeEventListener('abort',onAbort);
        flight.listeners--;
        if(flight.listeners===0&&!flight.settled){
          if(pending.get(key)===flight)pending.delete(key);
          flight.controller.abort();
        }
      };
      const onAbort=()=>{
        finish();
        reject(new DOMException('Загрузка отменена','AbortError'));
      };
      signal.addEventListener('abort',onAbort,{once:true});
      if(signal.aborted){onAbort();return;}
      void flight.promise.then(data=>{
        if(subscribed){finish();resolve(structuredClone(data));}
      },cause=>{
        if(subscribed){finish();reject(cause);}
      });
    });
  };
}

export const loadCachedSpellCatalog=createCachedSpellCatalogLoader();

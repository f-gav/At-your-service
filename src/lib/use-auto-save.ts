import {useCallback, useEffect, useRef, useState} from 'react';
import {clearLocalDraft,writeLocalDraft} from './local-drafts';

export type AutoSavePhase = 'saved' | 'changed' | 'saving' | 'error';

/**
 * Debounced cloud saves with a local emergency draft.
 *
 * Serializes network writes (avoids the older save overwriting the newer).
 * A request acknowledges only the exact snapshot it sent. If edits occur
 * in-flight, those remain dirty and are saved in the next sequential request.
 * When offline / Supabase rejects a save, retain the local draft and show
 * explicit retry UI. Never claim success until the server confirms the write.
 */
export function useAutoSave({
  snapshot,initialSnapshot,draftKey,persist,enabled=true,delay=1100,
}: {
  snapshot:string;
  initialSnapshot:string;
  draftKey:string;
  persist:(snapshot:string)=>Promise<boolean>;
  enabled?:boolean;
  delay?:number;
}) {
  const [acknowledged,setAcknowledged] = useState(initialSnapshot);
  const savedRef=useRef(initialSnapshot);
  const currentRef=useRef(snapshot);
  const persistRef=useRef(persist);
  const inFlight=useRef<Promise<boolean>|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [savedAt,setSavedAt]=useState<number|null>(null);
  const [failedSnapshot,setFailedSnapshot]=useState<string|null>(null);
  const mounted=useRef(true);
  currentRef.current=snapshot;
  persistRef.current=persist;

  useEffect(()=>{
    mounted.current=true;
    return ()=>{
      // Internal navigation (including browser Back) unmounts the editor
      // without firing beforeunload/pagehide. Keep its final unsent snapshot.
      if(currentRef.current!==savedRef.current)
        writeLocalDraft(draftKey,savedRef.current,currentRef.current);
      mounted.current=false;
    };
  },[]);

  const dirty = snapshot!==acknowledged;
  const saveNow = useCallback(async function flush():Promise<boolean> {
    if (!enabled) return true;
    if (inFlight.current) {
      const succeeded=await inFlight.current;
      // A failed write must NOT be retried recursively: network errors can
      // otherwise loop forever and leave the UI stuck. Keep the local draft
      // and let the user retry or wait for a new edit / online event.
      if(!succeeded)return false;
      // A user may have continued typing while the older request was pending.
      return flush();
    }
    const payload=currentRef.current;
    if(payload===savedRef.current) return true;
    // Persist the latest edits locally before an asynchronous network request.
    // A tab can be closed before React runs its ordinary draft-writing effect.
    writeLocalDraft(draftKey,savedRef.current,payload);
    if(typeof navigator!=='undefined' && !navigator.onLine) {
      if(mounted.current){setError('Нет соединения с интернетом. Черновик сохранён на устройстве.');setFailedSnapshot(payload);}
      return false;
    }
    if(mounted.current){setSaving(true);setError('');}
    const pending=(async()=>{
      try {
        const ok=await persistRef.current(payload);
        if(!ok){
          if(mounted.current){setError('Не удалось сохранить в облако. Черновик остался на устройстве.');setFailedSnapshot(payload);}
          return false;
        }
        savedRef.current=payload;
        if(mounted.current) {
          setAcknowledged(payload);
          setSavedAt(Date.now());
          setError('');
          setFailedSnapshot(null);
        }
        if(currentRef.current===payload) clearLocalDraft(draftKey,payload);
        else writeLocalDraft(draftKey,payload,currentRef.current);
        return true;
      }catch(cause){
        if(mounted.current) {
          setError(cause instanceof Error?cause.message:'Не удалось сохранить лист. Черновик сохранён на устройстве.');
          setFailedSnapshot(payload);
        }
        return false;
      }finally{
        inFlight.current=null;
        if(mounted.current)setSaving(false);
      }
    })();
    inFlight.current=pending;
    return pending;
  },[draftKey,enabled]);

  // Synchronous local writes in an effect: no personal data in the SW cache.
  useEffect(()=>{
    if(!enabled)return;
    if(snapshot===acknowledged) clearLocalDraft(draftKey,snapshot);
    else writeLocalDraft(draftKey,savedRef.current,snapshot);
  },[snapshot,acknowledged,draftKey,enabled]);

  // Editing after a network failure enables another automatic attempt.
  useEffect(()=>{
    if(!enabled || !dirty || saving || failedSnapshot===snapshot)return;
    const timer=window.setTimeout(()=>{void saveNow();},delay);
    return ()=>window.clearTimeout(timer);
  },[snapshot,dirty,saving,delay,enabled,saveNow,failedSnapshot]);

  useEffect(()=>{
    if(!enabled)return;
    const preservePending=()=>{
      if(currentRef.current!==savedRef.current)
        writeLocalDraft(draftKey,savedRef.current,currentRef.current);
    };
    const onVisible=()=>{
      if(document.visibilityState==='hidden'){
        preservePending();
        if(currentRef.current!==savedRef.current)void saveNow();
      }
    };
    const onPageHide=()=>preservePending();
    const onOnline=()=>{
      if(currentRef.current!==savedRef.current) {
        setFailedSnapshot(null);
        void saveNow();
      }
    };
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      if(currentRef.current!==savedRef.current){
        preservePending();
        event.preventDefault();
      }
    };
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('online',onOnline);
    window.addEventListener('pagehide',onPageHide);
    window.addEventListener('beforeunload',onBeforeUnload);
    return ()=>{
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('online',onOnline);
      window.removeEventListener('pagehide',onPageHide);
      window.removeEventListener('beforeunload',onBeforeUnload);
    };
  },[saveNow,enabled,draftKey]);

  return {
    dirty, saving, error, savedAt,
    phase: (error && failedSnapshot===snapshot ? 'error' : saving?'saving':dirty?'changed':'saved') as AutoSavePhase,
    saveNow,
    retry:()=>{setFailedSnapshot(null);void saveNow();},
  };
}

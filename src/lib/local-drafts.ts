/**
 * Device-only recovery for unsaved character changes. Never silently apply a
 * draft whose baseline does not match the cloud revision. Previous tab or
 * revision snapshots are archived before the active slot is replaced.
 * Nothing in here is sent over the network or stored by the service worker.
 */
const PREFIX = 'ays-unsaved-draft-v1:';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const ARCHIVE_SUFFIX = ':archive:';
type LocalDraft = {base:string;snapshot:string;updatedAt:number;owner?:string};
export type DeviceDraftBackup = {base:string;snapshot:string;updatedAt:number};

export function characterDraftKey(userId:string,characterId:string):string {
  return PREFIX+userId+':'+characterId;
}
function parseRecord(text:string|null):LocalDraft|null {
  if(!text)return null;
  try {
    const value:unknown=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const draft=value as Partial<LocalDraft>;
    return typeof draft.base==='string'&&typeof draft.snapshot==='string'&&
      typeof draft.updatedAt==='number'&&Number.isFinite(draft.updatedAt)&&
      (draft.owner===undefined||typeof draft.owner==='string')
      ?draft as LocalDraft:null;
  }catch{return null;}
}
function validDraft(draft:LocalDraft|null):draft is LocalDraft {
  if(!draft)return false;
  if(Date.now()-draft.updatedAt>MAX_AGE)return false;
  try{JSON.parse(draft.snapshot);return true;}catch{return false;}
}
function archiveKeys(key:string):string[]{
  const prefix=key+ARCHIVE_SUFFIX;
  const result:string[]=[];
  try {
    for(let i=0;i<window.localStorage.length;i++){
      const stored=window.localStorage.key(i);
      if(stored?.startsWith(prefix))result.push(stored);
    }
  }catch{/* Storage can be unavailable in private mode. */}
  return result;
}
function archivedDrafts(key:string):DeviceDraftBackup[]{
  const result:DeviceDraftBackup[]=[];
  for(const archivedKey of archiveKeys(key)){
    try{
      const item=parseRecord(window.localStorage.getItem(archivedKey));
      if(validDraft(item))result.push(item);
      else window.localStorage.removeItem(archivedKey);
    }catch{/* A corrupt archived entry must not block editing. */}
  }
  return result;
}
/** All different-base device snapshots retained for manual export.
 * Never treat them as the cloud state or silently overwrite the editor. */
export function conflictingLocalDrafts(key:string,cloudSnapshot:string):DeviceDraftBackup[]{
  const drafts:DeviceDraftBackup[]=[];
  try{
    const current=parseRecord(window.localStorage.getItem(key));
    if(validDraft(current)&&current.base!==cloudSnapshot)
      drafts.push(current);
  }catch{/* Optional recovery data must never crash the sheet. */}
  drafts.push(...archivedDrafts(key).filter(item=>item.base!==cloudSnapshot));
  const seen=new Set<string>();
  return drafts.filter(item=>{
    const signature=item.base+'\u0000'+item.snapshot;
    if(seen.has(signature))return false;
    seen.add(signature);return true;
  }).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function recoverLocalDraft(key:string,serverSnapshot:string):string|null {
  try{
    const draft=parseRecord(window.localStorage.getItem(key));
    const expired=!!draft&&Date.now()-draft.updatedAt>MAX_AGE;
    if(!validDraft(draft)) {
      if(expired)
        window.localStorage.removeItem(key);
      return null;
    }
    return draft.base===serverSnapshot&&draft.snapshot!==serverSnapshot
      ?draft.snapshot:null;
  }catch{return null;}
}
function archiveExisting(key:string,existing:LocalDraft):boolean {
  try {
    const archiveKey=key+ARCHIVE_SUFFIX+Date.now().toString(36)+'-'+
      Math.random().toString(36).slice(2,10);
    window.localStorage.setItem(archiveKey,JSON.stringify(existing));
    return true;
  }catch{return false;}
}
/** Returns false when local persistence is blocked/quota-exceeded.
 * On a different baseline or another tab owner, archive before replacement;
 * fail closed if the archive cannot be written. */
export function writeLocalDraft(
  key:string,base:string,snapshot:string,owner?:string,
):boolean {
  try{
    if(snapshot===base){clearLocalDraft(key,base);return true;}
    const old=parseRecord(window.localStorage.getItem(key));
    if(validDraft(old)&&old.snapshot!==snapshot&&
      (old.base!==base||!!(old.owner&&owner&&old.owner!==owner))){
      if(!archiveExisting(key,old))return false;
    }
    window.localStorage.setItem(key,JSON.stringify({
      base,snapshot,updatedAt:Date.now(),...(owner?{owner}:{}),
    } satisfies LocalDraft));
    return true;
  }catch{return false;}
}
/** Never remove a different tab's newer draft while acknowledging a save. */
export function clearLocalDraft(key:string,expectedSnapshot?:string):void {
  try{
    if(expectedSnapshot!==undefined){
      const record=parseRecord(window.localStorage.getItem(key));
      if(!record||record.snapshot!==expectedSnapshot)return;
    }
    window.localStorage.removeItem(key);
  }catch{/* No localStorage permission. */}
}

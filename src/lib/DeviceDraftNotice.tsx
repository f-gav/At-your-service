import {useState} from 'react';
import {Download,AlertTriangle} from 'lucide-react';
import {conflictingLocalDrafts} from './local-drafts';
import './DeviceDraftNotice.css';

/**
 * Never auto-merge a device draft against a newer cloud revision. Offer a
 * local-only export so the player can inspect/copy their edits without
 * weakening optimistic concurrency or changing cloud data.
 */
export default function DeviceDraftNotice({
  draftKey,cloudSnapshot,
}:{
  draftKey:string;
  cloudSnapshot:string;
}){
  const [initialBackups]=useState(()=>conflictingLocalDrafts(draftKey,cloudSnapshot));
  if(initialBackups.length===0)return null;
  function download(){
    const snapshots=conflictingLocalDrafts(draftKey,cloudSnapshot);
    const all=snapshots.length>0?snapshots:initialBackups;
    const body=JSON.stringify({
      format:'at-your-service-device-drafts-v1',
      warning:'Локальные черновики для ручного сравнения, не для автоматического импорта.',
      drafts:all,
    },null,2);
    const blob=new Blob([body],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='At-your-service-device-drafts.json';
    document.body.appendChild(anchor);
    anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="ays-device-draft-warning" role="status">
    <AlertTriangle size={17} aria-hidden="true"/>
    <span>На этом устройстве сохранились правки от другой версии персонажа.
      Они не применялись поверх облачной версии. Скачайте их для ручного сравнения.</span>
    <button type="button" onClick={download}><Download size={15}/> Скачать черновик</button>
  </div>;
}

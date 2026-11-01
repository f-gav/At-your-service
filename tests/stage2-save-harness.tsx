import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useAutoSave} from '../src/lib/use-auto-save';
import AutoSaveStatus from '../src/lib/AutoSaveStatus';
import DeviceDraftNotice from '../src/lib/DeviceDraftNotice';
import {characterDraftKey,writeLocalDraft} from '../src/lib/local-drafts';
import {StaleCharacterError} from '../src/lib/character-save';

type Entry={payload:string;resolve:(value:boolean)=>void;reject:(error:Error)=>void};
const gate:{mode:'hold'|'success'|'reject'|'conflict';calls:string[];pending:Entry[]}={
  mode:'success',calls:[],pending:[],
};
(window as unknown as {__AYS_SAVE_TEST__:typeof gate}).__AYS_SAVE_TEST__=gate;
const key=characterDraftKey('synthetic-user','synthetic-character');
const baseline=JSON.stringify({notes:''});
function App(){
  const [notes,setNotes]=useState('');
  const [closed,setClosed]=useState(false);
  const auto=useAutoSave({
    snapshot:JSON.stringify({notes}),initialSnapshot:baseline,draftKey:key,delay:30,
    persist:async payload=>{
      gate.calls.push(payload);
      if(gate.mode==='reject')throw new Error('Тестовая ошибка сети');
      if(gate.mode==='conflict')throw new StaleCharacterError();
      if(gate.mode==='hold')
        return new Promise<boolean>((resolve,reject)=>gate.pending.push({payload,resolve,reject}));
      return true;
    },
  });
  return <main>
    <AutoSaveStatus phase={auto.phase} error={auto.error} savedAt={auto.savedAt} onRetry={auto.retry}/>
    <div id="status" role="status">{auto.phase}</div>
    {auto.error&&<p id="save-error" role="alert">{auto.error}</p>}
    {auto.localWarning&&<p id="device-error" role="alert">{auto.localWarning}</p>}
    <DeviceDraftNotice draftKey={key} cloudSnapshot={baseline}/>
    <label>Заметки <input id="notes" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <button id="back" type="button" onClick={()=>void auto.saveNow().then(ok=>{if(ok)setClosed(true);})}>Назад</button>
    <span id="closed">{closed?'closed':'open'}</span>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

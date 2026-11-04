import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Save,BookOpen} from 'lucide-react';
import AutoSaveStatus from '../../../lib/AutoSaveStatus';
import {useAutoSave} from '../../../lib/use-auto-save';
import {characterDraftKey,recoverLocalDraft} from '../../../lib/local-drafts';
import DeviceDraftNotice from '../../../lib/DeviceDraftNotice';
import DiceRollPanel from '../../../lib/DiceRollPanel';
import {normalizedName} from '../../../lib/models';
import type {Character,CharacterDetails} from '../../../lib/models';
import type {CropFrame} from '../../portrait/crop';
import type {Dnd5eSheet} from '../domain/model';
import {validateDndSheet} from '../domain/validation';
import {packDndSheet,prepareDndDetails} from '../infra/transfer';
import Classic2014Pages from './Classic2014Pages';
import type {EditDnd} from './Classic2014Pages';
import './Classic2014.css';

type Props={
  character:Character;
  onSave:(id:string,name:string,details:CharacterDetails)=>Promise<boolean>;
  onClose:()=>void;
  portraitUrl?:string;
  portraitFrame?:CropFrame;
  onEditPortrait:()=>void;
};
type Draft={name:string;sheet:Dnd5eSheet};
const pages=['Основной лист','Биография','Заметки','Заклинания'] as const;
function initialDraft(character:Character):Draft {
  const sheet=packDndSheet(character.details.dnd5eSheet,character.name);
  // The card name is canonical; never let old nested data rename a character.
  return {name:character.name,sheet:{...sheet,identity:{...sheet.identity,name:character.name}}};
}
export default function Classic2014Sheet({character,onSave,onClose,portraitUrl,portraitFrame,onEditPortrait}:Props){
  const draftKey=characterDraftKey(character.user_id,character.id);
  const [serverBaseline]=useState(()=>JSON.stringify(initialDraft(character)));
  const [draft,setDraft]=useState<Draft>(()=>{
    const initial=JSON.parse(serverBaseline) as Draft;
    const recovered=recoverLocalDraft(draftKey,serverBaseline);
    if(!recovered)return initial;
    try {
      const next:unknown=JSON.parse(recovered);
      if(next&&typeof next==='object'&&!Array.isArray(next)){
        const payload=next as Record<string,unknown>;
        if(typeof payload.name==='string'&&payload.name.length<=100){
          const sheet=validateDndSheet(payload.sheet);
          return {name:payload.name,sheet};
        }
      }
    }catch{/* corrupted/stale device snapshot: notice remains available */}
    return initial;
  });
  const [activePage,setActivePage]=useState(1);
  const snapshot=useMemo(()=>JSON.stringify(draft),[draft]);
  const auto=useAutoSave({
    snapshot,initialSnapshot:serverBaseline,draftKey,
    persist:async serialized=>{
      const captured=JSON.parse(serialized) as Draft;
      const cleanName=normalizedName(captured.name);
      if(!cleanName)throw Error('Укажите имя героя на первой странице.');
      const verified=validateDndSheet({...captured.sheet,identity:{...captured.sheet.identity,name:cleanName}});
      // Keep the exact snapshot sent by this save operation; never overwrite
      // newer keystrokes with state captured by a stale component closure.
      return onSave(character.id,cleanName,prepareDndDetails(character.details,verified));
    },
  });
  const edit:EditDnd=change=>setDraft(previous=>{
    const sheet=structuredClone(previous.sheet);
    change(sheet);
    return {...previous,sheet};
  });
  const onName=(name:string)=>setDraft(previous=>({...previous,name,
    sheet:{...previous.sheet,identity:{...previous.sheet.identity,name}}}));
  async function closeSafely(){
    if(await auto.saveNow())onClose();
  }
  function go(page:number){
    setActivePage(page);
    document.getElementById('dnd14-page-'+page)?.scrollIntoView({
      block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
    });
  }
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      frame=0;
      for(let page=4;page>=1;page--){
        const rect=document.getElementById('dnd14-page-'+page)?.getBoundingClientRect();
        if(rect&&rect.top<=window.innerHeight*.38){setActivePage(page);break;}
        if(page===1)setActivePage(1);
      }
    };
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>{window.removeEventListener('scroll',onScroll);if(frame)cancelAnimationFrame(frame);};
  },[]);
  if(draft.sheet.layoutEdition!=='2014')return <main className="page page-editor dnd14-editor">
    <button className="dnd14-toolbar-action" type="button" onClick={onClose}><ArrowLeft size={16}/> К персонажам</button>
    <section className="dnd14-unavailable" role="alert">
      <h1>Лист D&D 2024 пока недоступен</h1>
      <p>Этот персонаж использует макет {draft.sheet.layoutEdition}. Данные сохранены без преобразования. Работа с листом 2024 появится в пакете №3.</p>
    </section>
  </main>;
  return <main className="page page-editor dnd14-editor" data-dnd-classic-version="2014">
    <div className="dnd14-toolbar">
      <div className="dnd14-toolbar-left">
        <button className="dnd14-toolbar-action" type="button" onClick={()=>void closeSafely()}>
          <ArrowLeft size={16}/> К персонажам
        </button>
        <span className="dnd14-toolbar-action" aria-label="Редакция D&D">D&D 5e · классический 2014</span>
      </div>
      <div className="dnd14-toolbar-right">
        <AutoSaveStatus phase={auto.phase} error={auto.error} savedAt={auto.savedAt} onRetry={auto.retry}/>
        <button className="dnd14-toolbar-action" type="button" onClick={()=>void auto.saveNow()} disabled={!auto.dirty||auto.saving}>
          <Save size={15}/> Сохранить
        </button>
      </div>
    </div>
    <DeviceDraftNotice draftKey={draftKey} cloudSnapshot={serverBaseline}/>
    {auto.localWarning&&<p className="form-error" role="alert">{auto.localWarning}</p>}
    <div className="dnd14-heading">
      <h1>Лист персонажа: {draft.name||'Без имени'}</h1>
      <span>Классический лист D&D 2014 · правила {draft.sheet.rulesEdition} · 4 страницы A4</span>
    </div>
    <nav className="dnd14-page-nav" aria-label="Страницы классического листа D&D 2014">
      {pages.map((title,i)=><button type="button" key={title} aria-current={activePage===i+1?'page':undefined}
        onClick={()=>go(i+1)}>{i+1}. {title}</button>)}
    </nav>
    <div className="dnd14-scroll" aria-label="Прокрутка бумажного листа по горизонтали">
      <Classic2014Pages sheet={draft.sheet} name={draft.name} onName={onName} edit={edit}
        portraitUrl={portraitUrl} portraitFrame={portraitFrame} onEditPortrait={onEditPortrait}/>
    </div>
    <p className="dnd14-sheet-note"><BookOpen size={14}/> Расширенный гримуар, дополнительные формулы и PDF появятся в следующих пакетах. Данные листа и заметки уже сохраняются.</p>
    <DiceRollPanel system="dnd5e"/>
  </main>;
}

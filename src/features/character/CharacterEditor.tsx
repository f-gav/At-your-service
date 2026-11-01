import {useState} from 'react';
import {ArrowLeft,FilePenLine,ShieldCheck} from 'lucide-react';
import AutoSaveStatus from '../../lib/AutoSaveStatus';
import {useAutoSave} from '../../lib/use-auto-save';
import {characterDraftKey,recoverLocalDraft} from '../../lib/local-drafts';
import DeviceDraftNotice from '../../lib/DeviceDraftNotice';
import {GAME_SYSTEMS,detailString,normalizedName} from '../../lib/models';
import type {Character,CharacterDetails} from '../../lib/models';

export default function CharacterEditor({
  character,
  onSave,
  onClose,
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
}) {
  const draftKey=characterDraftKey(character.user_id,character.id);
  const [serverBaseline]=useState(()=>JSON.stringify({
    name:character.name,
    concept:detailString(character.details,'concept'),
    chronicle:detailString(character.details,'chronicle'),
    notes:detailString(character.details,'notes'),
  }));
  const [initialDraft]=useState(()=>{
    const recovered=recoverLocalDraft(draftKey,serverBaseline);
    if(!recovered)return null;
    try {
      const value:unknown=JSON.parse(recovered);
      if(value&&typeof value==='object'&&!Array.isArray(value)) {
        const item=value as Record<string,unknown>;
        if(['name','concept','chronicle','notes'].every(key=>typeof item[key]==='string'))
          return item as {name:string;concept:string;chronicle:string;notes:string};
      }
    }catch{ /* stale or corrupt device draft */ }
    return null;
  });
  const [name,setName]=useState(()=>initialDraft?.name??character.name);
  const [concept,setConcept]=useState(()=>initialDraft?.concept??detailString(character.details,'concept'));
  const [chronicle,setChronicle]=useState(()=>initialDraft?.chronicle??detailString(character.details,'chronicle'));
  const [notes,setNotes]=useState(()=>initialDraft?.notes??detailString(character.details,'notes'));
  const auto=useAutoSave({
    snapshot:JSON.stringify({name,concept,chronicle,notes}),
    initialSnapshot:serverBaseline,draftKey,
    persist:async serialized=>{
      const captured=JSON.parse(serialized) as {name:string;concept:string;chronicle:string;notes:string};
      const cleanName=normalizedName(captured.name);
      if(!cleanName)throw new Error('Укажи имя персонажа.');
      const details:CharacterDetails={
        ...character.details,
        concept:captured.concept.slice(0,500),
        chronicle:captured.chronicle.slice(0,200),
        notes:captured.notes.slice(0,20000),
      };
      return onSave(character.id,cleanName,details);
    },
  });
  const editLocked=false;
  const {error}=auto;
  const system = GAME_SYSTEMS[character.system];

  async function goBack() {
    if(!(await auto.saveNow()))return;
    onClose();
  }

  return (
    <main className="page page-editor">
      <div className="editor-nav">
        <button className="text-button" type="button" onClick={() => void goBack()} disabled={editLocked}>
          <ArrowLeft size={17} /> К персонажам
        </button>
        <div className="editor-actions">
          <AutoSaveStatus phase={auto.phase} error={error} savedAt={auto.savedAt} onRetry={auto.retry}/>
        </div>
      </div>
      <DeviceDraftNotice draftKey={draftKey} cloudSnapshot={serverBaseline}/>
      {auto.localWarning&&<p className="form-error" role="alert">{auto.localWarning}</p>}
      <div className="sheet-heading">
        <div className="eyebrow"><span className="small-dot" /> {system.title.toUpperCase()} · {system.edition.toUpperCase()}</div>
        <h1>Лист персонажа<span className="punctuation">.</span></h1>
        <p>Черновик до появления игровых макетов. Данные сохраняются в твоём аккаунте, а структура может расширяться.</p>
      </div>

      <section className="paper" aria-label="Черновик листа персонажа">
        <div className="paper-topline"><span>AT YOUR SERVICE</span><span>{system.short.toUpperCase()} / CHARACTER SHEET</span></div>
        <div className="paper-row paper-row-major">
          <label className="field-label field-name">ИМЯ ПЕРСОНАЖА
            <input disabled={editLocked} maxLength={100} value={name} onChange={e => { setName(e.target.value); }} placeholder="Например, Авантюрист" autoComplete="off" />
          </label>
          <span className="sheet-placeholder-emblem" aria-hidden="true">{system.short}</span>
        </div>
        <div className="paper-grid">
          <label className="field-label">КОНЦЕПЦИЯ / ОПИСАНИЕ
            <input disabled={editLocked} maxLength={500} value={concept} onChange={e => { setConcept(e.target.value); }} placeholder="Кто этот персонаж?" />
          </label>
          <label className="field-label">КАМПАНИЯ / ХРОНИКА
            <input disabled={editLocked} maxLength={200} value={chronicle} onChange={e => { setChronicle(e.target.value); }} placeholder="Название истории" />
          </label>
        </div>
        <div className="divider-line" />
        <label className="field-label field-notes">ЗАМЕТКИ ПЕРСОНАЖА
          <textarea disabled={editLocked} rows={9} maxLength={20000} value={notes} onChange={e => { setNotes(e.target.value); }} placeholder="История, способности, предметы, планы…" />
        </label>
        <div className="paper-footer"><span>ПОЛНЫЙ ЛИСТ ПОЯВИТСЯ ПОСЛЕ УТВЕРЖДЕНИЯ МАКЕТА</span><FilePenLine size={18} /></div>
      </section>
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="editor-hint"><ShieldCheck size={15} /> Можно редактировать свободно. При выходе через «К персонажам» несохранённые изменения будут сохранены автоматически.</p>
    </main>
  );
}

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import AutoSaveStatus from './lib/AutoSaveStatus';
import {parseSiteRoute,siteRouteHash} from './lib/routes';
import {useAutoSave} from './lib/use-auto-save';
import {characterDraftKey,recoverLocalDraft} from './lib/local-drafts';
import {usePwaInstall} from './lib/use-pwa-install';
import type { FormEvent, ChangeEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
  Check,
  FilePenLine,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Trash2,
  MoreHorizontal,
  Copy,
  FileDown,
  Download,
  Upload,
  X,
} from 'lucide-react';
import {
  GAME_SYSTEMS,
  defaultDetails,
  detailString,
  normalizeDetails,
  normalizedName,
  moveCharacterToIndex,
  systemKeys,
  creatableSystemKeys,
  canCreateCharacter,
} from './lib/models';
import type { Character, CharacterDetails, GameSystem } from './lib/models';
import { getReturnUrl, isConfigured, supabase } from './lib/supabase';
import { downloadCharacter, parseCharacterJson } from './lib/character-json';
import PathfinderSheet from './features/pathfinder/PathfinderSheet';
import ProjectMoonSheet from './features/project-moon/ProjectMoonSheet';
import { emptyMoonSheet, moonSubtitle } from './features/project-moon/model';
import PortraitEditor from './features/portrait/PortraitEditor';
import PortraitImage from './features/portrait/PortraitImage';
import type { PortraitCrops } from './features/portrait/crop';
import { cleanupBeforeDelete, portraitPaths, removePortrait, savePortrait, saveLegacyPortrait, signedPortraitUrl, downloadPortraitBlob } from './features/portrait/portrait-storage';
import SheetAdmin from './features/sheet-admin/SheetAdmin';
import SpellLibrary from './features/spell-library/SpellLibrary';
import { pathfinderSubtitle } from './features/pathfinder/summary';

type Filter = GameSystem | 'all';
type CreatePanel = GameSystem | null;

function messageFromError(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String(error.message);
    if (message.includes("Could not find the table 'public.characters'")) {
      return 'Таблица персонажей не создана. Запусти supabase/schema.sql в SQL Editor.';
    }
    return message;
  }
  return 'Неизвестная ошибка. Попробуй ещё раз.';
}

function SiteLogo() {
  return (
    <span className="brand-wrap" aria-label="At your service!">
      <img className="brand-icon" src={`${import.meta.env.BASE_URL}site-icon.png`} alt="" aria-hidden="true" />
      <img className="brand-wordmark" src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="At your service!" />
    </span>
  );
}

/** Decorative silhouette from the approved homepage mockup. */
function HeroEmblem() {
  return (
    <svg className="hero-emblem" viewBox="0 0 324 118" aria-hidden="true" focusable="false">
      <path d="M162 2 181 14H143Z" />
      <path d="M105 18h114c16 0 29 13 29 29v47H76V47c0-16 13-29 29-29Z" />
      <path d="M65 80h194c9 0 16 7 16 16v2H49v-2c0-9 7-16 16-16Z" />
      <path d="M0 100h324l-28 17H28Z" />
    </svg>
  );
}

const WRECKTRACK_URL = 'https://f-gav.github.io/WreckTrack/';

const badgeLabels: Record<GameSystem, string> = {
  dnd5e: 'DnD',
  pf2e: 'PF2e',
  vtm5e: 'VtM',
  prmoon: 'Pr. Moon',
};

function characterSubtitle(character: Character): string {
  if (character.system === 'pf2e') return pathfinderSubtitle(character.details);
  if (character.system === 'prmoon') return moonSubtitle(character.details);
  const race = detailString(character.details, 'race').trim();
  const className = detailString(character.details, 'class').trim();
  if (race || className) return [race, className].filter(Boolean).join(' · ');
  return detailString(character.details, 'concept').trim() || 'Раса · Класс';
}

function EmptySetup() {
  return (
    <div className="setup-notice" role="status">
      <span className="setup-notice-icon"><ShieldCheck size={19} /></span>
      <span><strong>Подключение аккаунтов ещё не настроено.</strong><br />
        Главная страница работает. Для входа и облачного сохранения необходимо добавить параметры Supabase в GitHub Actions Variables и включить Google OAuth. Инструкция — в <code>docs/SETUP-RU.md</code>.
      </span>
    </div>
  );
}

function CharacterEditor({
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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isTemplateAdmin,setIsTemplateAdmin]=useState(false);
  const [showTemplateAdmin,setShowTemplateAdmin]=useState(false);
  const [mainTab,setMainTab]=useState<'characters'|'library'>(()=>parseSiteRoute(window.location.hash).kind==='library'?'library':'characters');
  // Reset the new page position before paint. Scrolling the old page inside
  // navigateTo could visibly move the header when content height changes.
  useLayoutEffect(()=>{
    window.scrollTo({top:0,behavior:'instant'});
  },[mainTab]);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Opening or closing a character must not inherit the dashboard's scroll
  // position. On mobile that could land the Project Moon sheet on Notes.
  useLayoutEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:'instant'});
  },[activeId]);
  const [createPanel, setCreatePanel] = useState<CreatePanel>(null);
  const [showSystemPicker, setShowSystemPicker] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [duplicateTarget,setDuplicateTarget] = useState<Character|null>(null);
  const [duplicatePortrait,setDuplicatePortrait] = useState(true);
  const [exportPdfId,setExportPdfId] = useState<string|null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPfVariant,setNewPfVariant]=useState<'classic'|'alternative'>('classic');
  const [pendingImport,setPendingImport]=useState<ReturnType<typeof parseCharacterJson>|null>(null);
  const [importPfVariant,setImportPfVariant]=useState<'classic'|'alternative'>('classic');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [editingPortraitId,setEditingPortraitId] = useState<string|null>(null);
  const [portraitUrls,setPortraitUrls] = useState<Record<string,string>>({});
  const {canInstall,install}=usePwaInstall();
  // Hash routes are bookmarkable and survive reloads, back/forward and OAuth redirects.
  useEffect(()=>{
    const sync=()=>{
      const route=parseSiteRoute(window.location.hash);
      setShowTemplateAdmin(false);
      setMainTab(route.kind==='library'?'library':'characters');
      setActiveId(route.kind==='character'?route.id:null);
      setMobileMenu(false);
    };
    window.addEventListener('hashchange',sync);
    return()=>window.removeEventListener('hashchange',sync);
  },[]);
  function navigateTo(tab:'characters'|'library'){
    if(showTemplateAdmin)setShowTemplateAdmin(false);
    setMainTab(tab);setActiveId(null);setMobileMenu(false);setMovingId(null);setOpenMenuId(null);
    closeCreate();
    window.location.hash=siteRouteHash({kind:tab});
    // Hash navigation can race browser scroll restoration when switching away
    // from a long paginated library; always reset the destination viewport.
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  function openCharacter(id:string){
    setMainTab('characters');setActiveId(id);setOpenMenuId(null);setError('');
    window.location.hash=siteRouteHash({kind:'character',id});
  }
  function closeCharacter(){
    setActiveId(null);setFilter('all');
    window.location.hash=siteRouteHash({kind:'characters'});
  }

  const user = session?.user;
  useEffect(()=>{
    if(!supabase||!user?.id){setIsTemplateAdmin(false);setShowTemplateAdmin(false);return;}
    let active=true;
    void supabase.from('sheet_admins').select('user_id').eq('user_id',user.id).maybeSingle()
      .then(({data,error})=>{if(active)setIsTemplateAdmin(!error&&!!data);});
    return()=>{active=false;};
  },[user?.id]);
  const active = useMemo(() => characters.find(c => c.id === activeId) ?? null, [characters, activeId]);
  const portraitCharacter = characters.find(c=>c.id===editingPortraitId) ?? null;
  const signedPaths = useMemo(() => [...new Set(characters.flatMap(portraitPaths))], [characters]);
  useEffect(()=>{
    if(!supabase||!user?.id||!signedPaths.length){setPortraitUrls({});return;}
    let mounted=true;
    void Promise.all(signedPaths.map(async path=>{
      try{return [path,await signedPortraitUrl(path)] as const;}
      catch{return [path,''] as const;}
    })).then(rows=>{if(mounted)setPortraitUrls(Object.fromEntries(rows));});
    return()=>{mounted=false;};
  },[user?.id,signedPaths]);
  async function savePortraitChange(source:Blob,crops:PortraitCrops) {
    if(!portraitCharacter||!user)return;
    const next=await savePortrait(portraitCharacter,user.id,source,crops);
    setCharacters(old=>old.map(c=>c.id===portraitCharacter.id?{...c,...next}:c));
  }
  async function removePortraitChange() {
    if(!portraitCharacter||!user)return;
    const next=await removePortrait(portraitCharacter,user.id);
    setCharacters(old=>old.map(c=>c.id===portraitCharacter.id?{...c,...next}:c));
  }
  const filteredCharacters = useMemo(() => characters.filter(c => filter === 'all' || c.system === filter), [characters, filter]);
  const movingIndex = characters.findIndex(c => c.id === movingId);
  const movingCharacter = movingIndex >= 0 ? characters[movingIndex] : null;

  useEffect(() => {
    if (!openMenuId) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.character-menu-area')) {
        setOpenMenuId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!movingId) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setMovingId(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [movingId, busy]);

  useEffect(() => {
    if (!showSystemPicker && !createPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setShowSystemPicker(false);
        setCreatePanel(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showSystemPicker, createPanel, busy]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const client = supabase;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthReady(true);
    });
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError) setError(messageFromError(authError));
      setSession(data.session);
      setAuthReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!supabase || !userId) {
      setCharacters([]);
      setActiveId(null);
      setMovingId(null);
      setLoadingCharacters(false);
      return;
    }
    let cancelled = false;
    setLoadingCharacters(true);
    setCharacters([]);
    const client = supabase;
    void client.from('characters')
      .select('id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setLoadingCharacters(false);
        if (loadError) setError(messageFromError(loadError));
        else {
          const owned=(data ?? []).map(row => ({ ...row, details: normalizeDetails(row.details) })) as Character[];
          setCharacters(owned);
          const route=parseSiteRoute(window.location.hash);
          if(route.kind==='character') {
            if(owned.some(character=>character.id===route.id))setActiveId(route.id);
            else {setActiveId(null);setError('Персонаж не найден в твоём аккаунте или доступ к нему отсутствует.');}
          }
        }
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function signIn() {
    if (!supabase) {
      setError('Сначала подключи Supabase по инструкции из docs/SETUP-RU.md.');
      return;
    }
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getReturnUrl() },
    });
    if (signInError) setError(messageFromError(signInError));
  }

  async function signOut() {
    if (!supabase) return;
    if (activeId && !window.confirm('Перед выходом убедись, что изменения листа сохранены. Выйти из аккаунта?')) return;
    setError('');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(messageFromError(signOutError));
    else {
      setActiveId(null);
      setCreatePanel(null);
      setShowSystemPicker(false);
      setCharacters([]);
      setMovingId(null);
    }
  }

  function openCreate() {
    if (!user) {
      void signIn();
      return;
    }
    setActiveId(null);
    setCreatePanel(null);
    setShowSystemPicker(true);
    setOpenMenuId(null);
    setMovingId(null);
    setError('');
  }

  function closeCreate() {
    if (busy) return;
    setShowSystemPicker(false);
    setCreatePanel(null);
    setNewName('');
  }

  function beginCreate(system: GameSystem) {
    if (!canCreateCharacter(system)) return;
    if (!user) {
      void signIn();
      return;
    }
    setShowSystemPicker(false);
    setCreatePanel(system);
    setNewPfVariant('classic');
    setNewName('');
    setError('');
  }

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !createPanel || !canCreateCharacter(createPanel) || busy) return;
    const name = normalizedName(newName);
    if (!name) { setError('Укажи имя персонажа.'); return; }
    setBusy(true);
    setError('');
    const nextOrder = characters.reduce((max, character) => Math.max(max, character.sort_order), 0) + 1;
    const { data, error: insertError } = await supabase.from('characters')
      .insert({ user_id: user.id, system: createPanel, name,
         details: createPanel === 'prmoon' ? { ...defaultDetails(), projectMoonSheet: emptyMoonSheet() } :
           createPanel === 'pf2e' ? { ...defaultDetails(), pathfinderSheet:{pf2e_layout:newPfVariant} } : defaultDetails(),
         sort_order: nextOrder })
      .select('id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops').single();
    setBusy(false);
    if (insertError) { setError(messageFromError(insertError)); return; }
    if (!data) return;
    const created = { ...data, details: normalizeDetails(data.details) } as Character;
    setCharacters(current => [...current, created]);
    setCreatePanel(null);
    setShowSystemPicker(false);
    openCharacter(created.id);
  }

  async function saveCharacter(id: string, name: string, details: CharacterDetails): Promise<boolean> {
    if (!supabase || !user) return false;
    const { data, error: saveError } = await supabase.from('characters')
      .update({ name, details })
      .eq('id', id).eq('user_id', user.id)
      .select('id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops').single();
    if (saveError || !data) {
      setError(messageFromError(saveError));
      return false;
    }
    setError('');
    setCharacters(current => current.map(c => c.id === id ? { ...data, details: normalizeDetails(data.details) } as Character : c));
    return true;
  }

  async function completeImport(parsed:ReturnType<typeof parseCharacterJson>,variant?:'classic'|'alternative'){
    if(!supabase||!user||importingJson)return;
    setImportingJson(true);setError('');
    try{
      const details:CharacterDetails=parsed.system==='pf2e'?
        {...parsed.details,pathfinderSheet:{
          ...(parsed.details.pathfinderSheet as Record<string,unknown>||{}),
          pf2e_layout:variant??'classic',
        }}:parsed.details;
      const nextOrder=characters.reduce((maximum,c)=>Math.max(maximum,c.sort_order),0)+1;
      const {data,error:importError}=await supabase.from('characters')
        .insert({user_id:user.id,system:parsed.system,name:parsed.name,details,sort_order:nextOrder})
        .select('id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops').single();
      if(importError||!data)throw importError??new Error('Не удалось создать персонажа.');
      let imported={...data,details:normalizeDetails(data.details)} as Character;
      if(parsed.portrait){
        try{
          const paths=parsed.portrait.type==='source'
            ?await savePortrait(imported,user.id,parsed.portrait.source,parsed.portrait.crops)
            :await saveLegacyPortrait(imported,user.id,parsed.portrait.card,parsed.portrait.sheet);
          imported={...imported,...paths};
        }catch(cause){
          await supabase.from('characters').delete().eq('id',imported.id).eq('user_id',user.id);
          throw cause;
        }
      }
      setCharacters(current=>[...current,imported]);
      setFilter('all');setOpenMenuId(null);setPendingImport(null);
    }catch(cause){setError(messageFromError(cause));}
    finally{setImportingJson(false);}
  }
  async function importJson(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!supabase||!user||busy||importingJson)return;
    if(file.size>2*1024*1024){setError('JSON слишком большой (не более 2 МБ).');return;}
    setError('');
    try{
      const parsed=parseCharacterJson(await file.text());
      if(parsed.system==='pf2e'){
        const raw=parsed.details.pathfinderSheet;
        const layout=raw&&typeof raw==='object'&&!Array.isArray(raw)
          ?(raw as Record<string,unknown>).pf2e_layout:null;
        setImportPfVariant(layout==='alternative'?'alternative':'classic');
        setPendingImport(parsed);
        return;
      }
      await completeImport(parsed);
    }catch(cause){setError(messageFromError(cause));}
  }
  async function chooseCharacterVariant(character:Character,variant:'classic'|'alternative'){
    if(character.system!=='pf2e'||busy)return;
    const original=character.details.pathfinderSheet;
    const values=original&&typeof original==='object'&&!Array.isArray(original)
      ?original as Record<string,unknown>:{};
    const details={...character.details,pathfinderSheet:{...values,pf2e_layout:variant}};
    setOpenMenuId(null);
    await saveCharacter(character.id,character.name,details);
  }

  async function duplicateCharacter(character:Character,includePortrait:boolean) {
    if(!supabase||!user||busy)return;
    setBusy(true);setError('');
    let created:Character|null=null;
    try{
      const name=normalizedName(character.name+' (копия)').slice(0,100);
      const nextOrder=characters.reduce((max,c)=>Math.max(max,c.sort_order),0)+1;
      // JSON clone avoids shared mutable nested sheet data between characters.
      const details=normalizeDetails(JSON.parse(JSON.stringify(character.details)) as CharacterDetails);
      const {data,error:insertError}=await supabase.from('characters')
        .insert({user_id:user.id,system:character.system,name,details,sort_order:nextOrder})
        .select('id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops').single();
      if(insertError||!data)throw insertError??new Error('Не удалось продублировать лист.');
      created={...data,details:normalizeDetails(data.details)} as Character;
      if(includePortrait){
        if(character.portrait_source_path && character.portrait_crops){
          const blob=await downloadPortraitBlob(character.portrait_source_path);
          const paths=await savePortrait(created,user.id,blob,character.portrait_crops);
          created={...created,...paths};
        }else if(character.portrait_card_path&&character.portrait_sheet_path){
          const [card,sheet]=await Promise.all([
            downloadPortraitBlob(character.portrait_card_path),
            downloadPortraitBlob(character.portrait_sheet_path),
          ]);
          const paths=await saveLegacyPortrait(created,user.id,card,sheet);
          created={...created,...paths};
        }
      }
      setCharacters(current=>[...current,created!]);
      setFilter('all');
      setDuplicateTarget(null);
      setOpenMenuId(null);
    }catch(cause){
      if(created){
        try{await cleanupBeforeDelete(created);}catch{ /* best effort rollback */ }
        await supabase.from('characters').delete().eq('id',created.id).eq('user_id',user.id);
      }
      setError('Не удалось создать копию: '+messageFromError(cause));
    }finally{setBusy(false);}
  }

  function exportCharacterPdf(character:Character){
    if(busy)return;
    setOpenMenuId(null);setError('');
    setExportPdfId(character.id);
    openCharacter(character.id);
  }

  function beginMove(id: string) {
    if (busy) return;
    setFilter('all');
    setOpenMenuId(null);
    setMovingId(id);
    setError('');
  }

  async function moveCharacter(targetIndex: number) {
    if (!supabase || !user || !movingId || busy) return;
    const reordered = moveCharacterToIndex(characters, movingId, targetIndex);
    if (reordered.every((character, index) => character.id === characters[index].id)) return;

    const previous = characters;
    setBusy(true);
    setError('');
    setCharacters(reordered.map((character, index) => ({ ...character, sort_order: index + 1 })));
    // One database transaction updates the full order. If it fails, restore the previous list.
    try {
      const { error: moveError } = await supabase.rpc('reorder_characters', {
        p_ids: reordered.map(character => character.id),
      });
      if (moveError) throw moveError;
    } catch (moveError) {
      setCharacters(previous);
      setError(`Не удалось сохранить порядок: ${messageFromError(moveError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCharacter(character: Character) {
    if (!supabase || !user || busy) return;
    if (!window.confirm(`Удалить персонажа «${character.name}»? Это действие нельзя отменить.`)) return;
    setBusy(true);
    setError('');
    try { await cleanupBeforeDelete(character); }
    catch(cause) {setBusy(false);setError('Не удалось удалить файлы портрета: '+messageFromError(cause));return;}
    const { error: deleteError } = await supabase.from('characters').delete()
      .eq('id', character.id).eq('user_id', user.id);
    setBusy(false);
    if (deleteError) { setError(messageFromError(deleteError)); return; }
    setCharacters(current => current.filter(c => c.id !== character.id));
  }

  const displayName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name : user?.email?.split('@')[0] ?? 'Игрок';
  const avatar = typeof user?.user_metadata?.avatar_url === 'string' &&
    user.user_metadata.avatar_url.startsWith('https://') ? user.user_metadata.avatar_url : null;

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="brand-button" onClick={() => { if (!showTemplateAdmin) { navigateTo('characters'); setFilter('all'); } }} aria-label="На главную">
            <SiteLogo />
          </button>
          <nav className="site-nav" aria-label="Основные разделы">
            <button type="button" aria-current={mainTab==='characters'?'page':undefined} className={mainTab==='characters'?'is-active':''}
              disabled={showTemplateAdmin} onClick={()=>navigateTo('characters')}>Персонажи</button>
            <button type="button" aria-current={mainTab==='library'?'page':undefined} className={mainTab==='library'?'is-active':''}
              disabled={!!activeId||showTemplateAdmin} title={activeId?'Вернись к персонажам, чтобы открыть библиотеку':undefined} onClick={()=>navigateTo('library')}>Библиотека</button>
          </nav>
          <div className="header-links">
            {!authReady ? <span className="muted">Подключение…</span> : user ? (
              <div className="account-actions">
                <span className="account-identity" aria-label={`Аккаунт: ${displayName}`} title={displayName}>
                  {avatar ? <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
                </span>
                <button className="icon-button" type="button" title="Выйти из аккаунта" aria-label="Выйти из аккаунта" onClick={() => void signOut()}><LogOut size={17} /></button>
              </div>
            ) : <button className="button button-header" type="button" onClick={() => void signIn()}><LogIn size={16} /> Войти через Google</button>}
          </div>
          <button type="button" className="mobile-menu-button" aria-label="Меню" aria-expanded={mobileMenu} aria-controls="ays-header-menu" onClick={() => setMobileMenu(open => !open)}>{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {mobileMenu && <div className="mobile-menu-panel" id="ays-header-menu">
          <div className="mobile-account-row">
            {user ? <>
              <span className="mobile-account-identity" aria-label={`Аккаунт: ${displayName}`} title={displayName}>
                {avatar ? <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
              </span>
              <span className="mobile-account-name">{displayName}</span>
              <button type="button" className="mobile-signout" onClick={() => {setMobileMenu(false);void signOut();}}><LogOut size={16}/> Выйти из аккаунта</button>
            </> : <button type="button" onClick={() => {setMobileMenu(false);void signIn();}}><LogIn size={16}/> Войти через Google</button>}
          </div>
          <div className="mobile-menu-links">
            {canInstall && <button type="button" onClick={()=>{setMobileMenu(false);void install();}}><Download size={17}/> Установить приложение</button>}
            {isTemplateAdmin && user && <button type="button" onClick={()=>{setActiveId(null);setShowTemplateAdmin(true);setMobileMenu(false);}}><FilePenLine size={17}/> Редактор листов</button>}
            <a className="mobile-menu-action" href={WRECKTRACK_URL} target="_blank" rel="noreferrer" onClick={()=>setMobileMenu(false)}><ArrowRight size={17}/> WreckTrack</a>
          </div>
        </div>}
        <nav className="site-tabs-mobile" aria-label="Основные разделы">
          <button type="button" aria-current={mainTab==='characters'?'page':undefined} className={mainTab==='characters'?'is-active':''}
            disabled={showTemplateAdmin} onClick={()=>navigateTo('characters')}>Персонажи</button>
          <button type="button" aria-current={mainTab==='library'?'page':undefined} className={mainTab==='library'?'is-active':''}
            disabled={!!activeId||showTemplateAdmin} onClick={()=>navigateTo('library')}>Библиотека</button>
        </nav>
      </header>

      {showTemplateAdmin && user && isTemplateAdmin ? (
        <SheetAdmin userId={user.id} onClose={()=>setShowTemplateAdmin(false)}/>
      ) : active ? (
        active.system === 'pf2e' ? (
          <PathfinderSheet key={active.id} character={active}
            portraitUrl={active.portrait_source_path?portraitUrls[active.portrait_source_path]:active.portrait_sheet_path?portraitUrls[active.portrait_sheet_path]:undefined}
            portraitFrame={active.portrait_source_path?active.portrait_crops?.sheet:undefined}
            onEditPortrait={()=>setEditingPortraitId(active.id)}
            onSave={saveCharacter} onClose={closeCharacter} autoExport={exportPdfId===active.id} onAutoExportComplete={()=>setExportPdfId(null)} />
        ) : active.system === 'prmoon' ? (
          <ProjectMoonSheet key={active.id} character={active}
            portraitUrl={active.portrait_source_path ? portraitUrls[active.portrait_source_path] : active.portrait_sheet_path ? portraitUrls[active.portrait_sheet_path] : undefined}
            portraitFrame={active.portrait_source_path ? active.portrait_crops?.sheet : undefined}
            onEditPortrait={() => setEditingPortraitId(active.id)}
            onSave={saveCharacter} onClose={closeCharacter} autoExport={exportPdfId===active.id} onAutoExportComplete={()=>setExportPdfId(null)} />
        ) : (
          <CharacterEditor key={active.id} character={active} onSave={saveCharacter} onClose={closeCharacter} />
        )
      ) : mainTab==='library' ? (
        <SpellLibrary onBack={()=>navigateTo('characters')} />
      ) : (
        <main className="page page-home">
          <section className="hero" aria-labelledby="main-title">
            <div className="hero-copy">
              <h1 id="main-title"><img src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="At your service!" /></h1>
              <p>Храни свою историю, чтобы она не превратилась в Осколки!</p>
            </div>
            <HeroEmblem />
          </section>

          {!isConfigured && <EmptySetup />}
          {error && <div className="global-error" role="alert"><span>{error}</span><button aria-label="Закрыть ошибку" type="button" onClick={() => setError('')}><X size={16} /></button></div>}

          <section className="library-section" aria-labelledby="library-title">
            <div className="library-heading">
              <h2 id="library-title">Мои персонажи: ({characters.length})</h2>
              <label className="json-import-button" title="Загрузить лист персонажа из JSON">
                <Upload size={15} /> JSON
                <input type="file" accept=".json,application/json" aria-label="Импортировать JSON персонажа" disabled={!user || busy || importingJson} onChange={event => void importJson(event)} />
              </label>
              <div className="system-filters" role="group" aria-label="Фильтр персонажей по системе">
                {systemKeys.map((system, index) => (
                  <span className="filter-item" key={system}>
                    {index > 0 && <span className="filter-separator" aria-hidden="true">·</span>}
                    <button type="button" aria-pressed={filter === system} className={filter === system ? 'system-filter is-active' : 'system-filter'} onClick={() => { setMovingId(null); setFilter(current => current === system ? 'all' : system); }}>{system === 'dnd5e' ? 'D&D' : system === 'pf2e' ? 'PATHFINDER' : system === 'prmoon' ? 'PR. MOON' : 'VTM'}</button>
                  </span>
                ))}
              </div>
            </div>

            {movingCharacter && <div className="move-toolbar" role="status">
              <div className="move-toolbar-copy">
                <strong>Переместить: {movingCharacter.name}</strong>
                <span>Нажми на другую карточку, чтобы выбрать её позицию, или используй стрелки.</span>
              </div>
              <div className="move-toolbar-actions">
                <button type="button" className="move-step" title="На одну позицию назад" aria-label="На одну позицию назад" disabled={busy || movingIndex <= 0} onClick={() => void moveCharacter(movingIndex - 1)}><ArrowLeft size={18} /></button>
                <button type="button" className="move-step" title="На одну позицию вперёд" aria-label="На одну позицию вперёд" disabled={busy || movingIndex >= characters.length - 1} onClick={() => void moveCharacter(movingIndex + 1)}><ArrowRight size={18} /></button>
                <button type="button" className="move-finish" disabled={busy} onClick={() => setMovingId(null)}>Готово</button>
              </div>
            </div>}

            <div className="character-grid">
              {loadingCharacters ? (
                <div className="library-state" role="status">Загружаем персонажей…</div>
              ) : filteredCharacters.map(character => (
                <article className={`character-card character-${character.system}${movingId === character.id ? ' is-moving' : movingId ? ' is-move-target' : ''}`} key={character.id} aria-label={`Персонаж ${character.name}`}>
                  <button type="button" className="character-open" disabled={busy && !!movingId} onClick={() => {
                    if (movingId) { void moveCharacter(characters.findIndex(c => c.id === character.id)); return; }
                    openCharacter(character.id);
                  }} aria-label={movingId ? movingId === character.id ? `Перемещаем персонажа ${character.name}` : `Переместить выбранного персонажа на позицию ${character.name}` : `Открыть лист персонажа ${character.name}`}>
                    <span className="character-portrait" aria-hidden="true">
                      {character.system === 'prmoon'
                        ? character.portrait_source_path && portraitUrls[character.portrait_source_path]
                          ? <PortraitImage url={portraitUrls[character.portrait_source_path]} frame={character.portrait_crops?.card} />
                          : character.portrait_card_path && portraitUrls[character.portrait_card_path]
                            ? <img src={portraitUrls[character.portrait_card_path]} alt="" />
                            : <img src={`${import.meta.env.BASE_URL}project-moon/character-icon.png`} alt="" />
                        : character.portrait_source_path && portraitUrls[character.portrait_source_path]
                          ? <PortraitImage url={portraitUrls[character.portrait_source_path]} frame={character.portrait_crops?.card} />
                          : character.portrait_card_path && portraitUrls[character.portrait_card_path]
                            ? <img src={portraitUrls[character.portrait_card_path]} alt="" />
                            : character.system==='pf2e'
                              ? <img className="character-portrait-placeholder" src={`${import.meta.env.BASE_URL}pathfinder/portrait-placeholder-simple.png`} alt="" />
                              : null}
                    </span>
                    <span className="character-data">
                      <strong>{character.name}</strong>
                      <span>{characterSubtitle(character)}</span>
                    </span>
                  </button>

                  <span className="character-system" aria-label={GAME_SYSTEMS[character.system].title}>{badgeLabels[character.system]}</span>
                  {!movingId && <div className="character-menu-area">
                    <button type="button" className="character-menu-button" title={`Действия с персонажем ${character.name}`} aria-label={`Действия с персонажем ${character.name}`} aria-expanded={openMenuId === character.id} onClick={() => setOpenMenuId(current => current === character.id ? null : character.id)}>
                      <MoreHorizontal size={25} strokeWidth={3} />
                    </button>
                    {openMenuId === character.id && <div className="character-menu" role="group" aria-label={`Действия: ${character.name}`}>
                      {(character.system==='pf2e'||character.system==='prmoon') && <button type="button" disabled={busy} onClick={() => exportCharacterPdf(character)}><FileDown size={15}/> Экспорт PDF</button>}
                      {character.system==='pf2e'&&<button type="button" disabled={busy}
                        onClick={()=>void chooseCharacterVariant(character,
                          (character.details.pathfinderSheet as Record<string,unknown>|undefined)?.pf2e_layout==='alternative'?'classic':'alternative')}>
                        <FilePenLine size={15}/> Переключить на {(character.details.pathfinderSheet as Record<string,unknown>|undefined)?.pf2e_layout==='alternative'?'классический PF2e':'Альтернативный PF2e'}
                      </button>}
                      <button type="button" onClick={() => {setOpenMenuId(null);void downloadCharacter(character).catch(cause=>setError(messageFromError(cause)));}}><Download size={15} /> Экспорт JSON</button>
                      <button type="button" onClick={() => {const url=window.location.origin+window.location.pathname+window.location.search+siteRouteHash({kind:'character',id:character.id});void navigator.clipboard.writeText(url).then(()=>setError('Ссылка на персонажа скопирована. Она доступна только владельцу аккаунта.')).catch(()=>setError('Не удалось скопировать ссылку.'));setOpenMenuId(null);}}><Copy size={15}/> Скопировать ссылку</button>
                      <button type="button" onClick={() => beginMove(character.id)}><MoveHorizontal size={15} /> Переместить</button>
                      <button type="button" onClick={() => {setOpenMenuId(null);setDuplicatePortrait(true);setDuplicateTarget(character);}} disabled={busy}><Copy size={15}/> Дублировать</button>
                      <button type="button" className="menu-delete" disabled={busy} onClick={() => { setOpenMenuId(null); void deleteCharacter(character); }}><Trash2 size={15} /> Удалить</button>
                    </div>}
                  </div>}
                </article>
              ))}
              <button type="button" className="add-character" onClick={openCreate} disabled={loadingCharacters || !!movingId || busy} aria-label="Создать персонажа"><Plus size={33} strokeWidth={2.2} /></button>
              {!loadingCharacters && filteredCharacters.length === 0 && filter !== 'all' && <div className="library-state">В этой системе пока нет персонажей. <button type="button" onClick={() => setFilter('all')}>Показать всех</button></div>}
            </div>
            {!user && authReady && <p className="library-help">Войди через Google, чтобы создавать персонажей и хранить их в своём аккаунте.</p>}
          </section>

          {(showSystemPicker || createPanel) && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeCreate(); }}>
            <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
              <div className="modal-top"><span>НОВЫЙ ПЕРСОНАЖ</span><button type="button" className="modal-close" onClick={closeCreate} disabled={busy} aria-label="Закрыть"><X size={21} /></button></div>
              {showSystemPicker ? <>
                <h2 id="create-title">Выбери игровую систему</h2>
                <p>Для какой истории создаём персонажа?</p>
                <div className="create-system-list">
                  {creatableSystemKeys.map((system, index) => <button type="button" autoFocus={index === 0} key={system} onClick={() => beginCreate(system)}>
                    <span><strong>{GAME_SYSTEMS[system].title}</strong><small>{GAME_SYSTEMS[system].subtitle}</small></span><ArrowRight size={18} />
                  </button>)}
                </div>
              </> : createPanel && <>
                <button type="button" className="text-button modal-back" onClick={() => { setCreatePanel(null); setShowSystemPicker(true); }} disabled={busy}><ArrowLeft size={16} /> К выбору системы</button>
                <h2 id="create-title">{GAME_SYSTEMS[createPanel].title}</h2>
                <p>Начни с имени. Остальное заполнишь в листе персонажа.</p>
                <form className="create-form" onSubmit={event => void createCharacter(event)}>
                  <label className="form-label">Имя персонажа
                    <input autoFocus required maxLength={100} placeholder="Как зовут твоего героя?" value={newName} onChange={event => setNewName(event.target.value)} />
                  </label>
                  {createPanel==='pf2e'&&<div className="pf-variant-choices" role="radiogroup" aria-label="Вид листа Pathfinder">
                    <label><input type="radio" name="new-pf-variant" checked={newPfVariant==='classic'} onChange={()=>setNewPfVariant('classic')}/> Классический PF2e <small>Привычный лист на основе PDF</small></label>
                    <label><input type="radio" name="new-pf-variant" checked={newPfVariant==='alternative'} onChange={()=>setNewPfVariant('alternative')}/> Альтернативный PF2e <small>Новый интерактивный HTML-лист</small></label>
                  </div>}
                  <button disabled={busy || !normalizedName(newName)} type="submit" className="button button-primary"><Plus size={17} /> {busy ? 'Создаю…' : 'Создать лист'}</button>
                </form>
              </>}
            </section>
          </div>}
        </main>
      )}

      {pendingImport&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!importingJson)setPendingImport(null);}}>
        <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="pf-import-variant-heading">
          <div className="modal-top"><span>ИМПОРТ PATHFINDER 2E</span>
            <button type="button" className="modal-close" aria-label="Отмена импорта" disabled={importingJson} onClick={()=>setPendingImport(null)}><X size={20}/></button>
          </div>
          <h2 id="pf-import-variant-heading">В каком виде открыть «{pendingImport.name}»?</h2>
          <p>Данные JSON одинаковы для обеих версий. Ты сможешь переключить лист позже без потери характеристик.</p>
          <div className="pf-variant-choices" role="radiogroup" aria-label="Вариант листа при импорте">
            <label><input type="radio" name="import-pf-variant" checked={importPfVariant==='classic'} onChange={()=>setImportPfVariant('classic')}/>
              Классический PF2e <small>Исходный русский PDF-лист</small></label>
            <label><input type="radio" name="import-pf-variant" checked={importPfVariant==='alternative'} onChange={()=>setImportPfVariant('alternative')}/>
              Альтернативный PF2e <small>HTML-лист в духе Pr. Moon и LSS</small></label>
          </div>
          <div className="duplicate-actions">
            <button type="button" className="button" disabled={importingJson} onClick={()=>setPendingImport(null)}>Отмена</button>
            <button type="button" className="button button-primary" disabled={importingJson}
              onClick={()=>void completeImport(pendingImport,importPfVariant)}>{importingJson?'Импортирую…':'Импортировать персонажа'}</button>
          </div>
        </section>
      </div>}
      {duplicateTarget && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setDuplicateTarget(null);}}>
        <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
          <div className="modal-top"><span>ДУБЛИРОВАНИЕ ПЕРСОНАЖА</span>
            <button type="button" className="modal-close" disabled={busy} aria-label="Закрыть" onClick={()=>setDuplicateTarget(null)}><X size={20}/></button></div>
          <h2 id="duplicate-title">Создать копию «{duplicateTarget.name}»?</h2>
          <p>Характеристики, заметки, оружие и настройки листа будут скопированы без изменений. Копия сохраняется как отдельный персонаж.</p>
          <label className="duplicate-portrait-option"><input type="checkbox" checked={duplicatePortrait}
            onChange={event=>setDuplicatePortrait(event.target.checked)} disabled={busy}/>
            Скопировать портрет и его кадрирование
          </label>
          <div className="duplicate-actions">
            <button type="button" className="button" disabled={busy} onClick={()=>setDuplicateTarget(null)}>Отмена</button>
            <button type="button" className="button button-primary" disabled={busy}
              onClick={()=>void duplicateCharacter(duplicateTarget,duplicatePortrait)}><Copy size={16}/> {busy?'Создаю…':'Дублировать'}</button>
          </div>
        </section>
      </div>}

      {portraitCharacter && <PortraitEditor key={portraitCharacter.id} name={portraitCharacter.name} system={portraitCharacter.system}
        existing={portraitPaths(portraitCharacter).length>0} onClose={()=>setEditingPortraitId(null)}
        onSave={savePortraitChange} onDelete={removePortraitChange}/>}
      <footer className="site-footer"><span>AT YOUR SERVICE <span className="footer-alpha">/ БЕТА</span></span><span>Создано для историй, которые стоит помнить. <Check size={13} /></span></footer>
    </div>
  );
}

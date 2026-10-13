import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { ArrowLeft, Check, RotateCcw, Save, UploadCloud, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Character } from '../../lib/models';
import ProjectMoonSheet from './ProjectMoonSheet';
import { emptyMoonSheet } from './model';
import {
  DEFAULT_MOON_LAYOUT, MOON_LAYOUT_CONTROLS, MOON_LAYOUT_KEY, MOON_TEXT_GROUPS,
  parseMoonLayout, encodeMoonLayout, isMoonPortraitShift, normalizeMoonTextStyle, cloneMoonTextStyles,
} from './layout-settings';
import type { MoonLayout, MoonLayoutKey, MoonTextGroup, MoonTextStyle } from './layout-settings';
import './MoonLayoutAdmin.css';

const previewCharacter: Character = {
  id: 'local-project-moon-preview', user_id: 'local-admin-preview', system: 'prmoon',
  name: 'Пример персонажа',
  details: { projectMoonSheet: {
    ...emptyMoonSheet(),
    fields: { rank: '1', level: '1', occupation: 'Фиксер', organization: 'Ассоциация',
      fortitude: '2', prudence: '2', determination: '2', charm: '2', discernment: '2',
      temperance: '2' },
  } },
  created_at: '', updated_at: '', sort_order: 0,
  portrait_card_path: null, portrait_sheet_path: null,
  portrait_source_path: null, portrait_crops: null,
};

type Props = { userId: string; onClose: () => void };
export default function MoonLayoutAdmin({userId,onClose}: Props) {
  const [layout, setLayout] = useState<MoonLayout>(() =>
    ({...DEFAULT_MOON_LAYOUT,textStyles:cloneMoonTextStyles()}));
  const [selectedTextGroup,setSelectedTextGroup] = useState<MoonTextGroup>('fieldLabel');
  const [selectedElement,setSelectedElement]=useState('');
  const [selectedLabel,setSelectedLabel]=useState('');
  const [styleClipboard,setStyleClipboard]=useState<MoonTextStyle|null>(null);
  const [lockedElements,setLockedElements]=useState<string[]>([]);
  const [device,setDevice]=useState<'desktop'|'tablet'|'mobile'>('desktop');
  const [publishedLayout,setPublishedLayout]=useState<MoonLayout|null>(null);
  const [autoSaving,setAutoSaving]=useState(false);
  const latestLayoutRef=useRef('');
  latestLayoutRef.current=JSON.stringify(layout);
  const [saved, setSaved] = useState(JSON.stringify(DEFAULT_MOON_LAYOUT));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [versions, setVersions] = useState<number[]>([]);
  const [restore, setRestore] = useState('');
  const dirty = saved !== JSON.stringify(layout);
  const [zoom,setZoom]=useState(100);
  const [numberDrafts,setNumberDrafts]=useState<Record<string,string>>({});
  const [undo,setUndo]=useState<MoonLayout[]>([]);
  const [redo,setRedo]=useState<MoonLayout[]>([]);
  const checkpoint=()=>{setUndo(old=>[...old.slice(-49),layout]);setRedo([]);};
  const undoOnce=()=>{
    if(!undo.length)return;
    setRedo(old=>[...old,layout]);
    setLayout(undo[undo.length-1]);setUndo(old=>old.slice(0,-1));
  };
  const redoOnce=()=>{
    if(!redo.length)return;
    setUndo(old=>[...old,layout]);
    setLayout(redo[redo.length-1]);setRedo(old=>old.slice(0,-1));
  };
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      if((event.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(event.code==='KeyZ'){event.preventDefault();if(event.shiftKey)redoOnce();else undoOnce();}
      else if(event.code==='KeyY'){event.preventDefault();redoOnce();}
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[undo,redo,layout]);


  useEffect(() => {
    if (!supabase) { setMessage('Supabase недоступен'); setLoading(false); return; }
    let mounted = true;
    void Promise.all([
      supabase.from('sheet_template_drafts').select('fields').eq('template_key', MOON_LAYOUT_KEY).maybeSingle(),
      supabase.from('sheet_templates').select('fields,version').eq('template_key', MOON_LAYOUT_KEY).maybeSingle(),
      supabase.from('sheet_template_history').select('version').eq('template_key', MOON_LAYOUT_KEY)
        .order('version',{ ascending: false }).limit(30),
    ]).then(([draft,published,history]) => {
      if (!mounted) return;
      setLoading(false);
      const error = draft.error || published.error || history.error;
      if (error) { setMessage('Ошибка загрузки: ' + error.message); return; }
      const next = parseMoonLayout(draft.data?.fields ?? published.data?.fields);
      setLayout(next); setSaved(JSON.stringify(next));
      setPublishedLayout(parseMoonLayout(published.data?.fields));
      setVersion(published.data?.version ?? 0);
      setVersions((history.data ?? []).map(entry => entry.version));
      setMessage(draft.data?.fields ? 'Загружен черновик.' : 'Загружена опубликованная разметка.');
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const currentTextStyle = selectedElement
    ? {...layout.textStyles[selectedTextGroup],...layout.elementStyles[selectedElement]}
    : layout.textStyles[selectedTextGroup];
  const pickElement=(event:MouseEvent<HTMLDivElement>)=>{
    const target=event.target as HTMLElement;
    const paper=target.closest<HTMLElement>('.moon-paper');
    if(!paper)return;
    const selectors:Record<MoonTextGroup,string>={
      pageKicker:'.moon-page-heading > span',pageTitle:'.moon-page-heading > h2',
      sectionTitle:'.moon-section-title',fieldLabel:'.moon-field > span',
      fieldValue:'.moon-field input',characterName:'.moon-name input',
      attributeLabel:'.moon-attribute-label',resourceTitle:'.moon-resource-title',
      cardTitle:'.moon-weapon-title',noteTitle:'.moon-notes-title',
      bodyText:'.moon-note textarea',
    };
    for(const {key} of MOON_TEXT_GROUPS){
      const node=target.closest(selectors[key]);
      if(!node || !paper.contains(node))continue;
      const index=Array.from(paper.querySelectorAll(selectors[key])).indexOf(node);
      if(index<0)continue;
      const page=Array.from(paper.classList).find(c=>c.startsWith('moon-page-'));
      if(!page)return;
      const id=`${page}|${key}:${index}`;
      setSelectedElement(id);setSelectedTextGroup(key);
      setSelectedLabel(node.textContent?.trim().slice(0,65)||key);
      return;
    }
  };
  const copyStyle=()=>setStyleClipboard({...currentTextStyle});
  const pasteStyle=()=>{
    if(!styleClipboard)return;
    checkpoint();
    setLayout(old=>selectedElement
      ? {...old,elementStyles:{...old.elementStyles,[selectedElement]:{...styleClipboard}}}
      : {...old,textStyles:{...old.textStyles,[selectedTextGroup]:{...styleClipboard}}});
  };
  const resetIndividual=()=>{
    if(!selectedElement)return;
    checkpoint();
    setLayout(old=>{const next={...old.elementStyles};delete next[selectedElement];return {...old,elementStyles:next};});
  };
  useEffect(()=>{
    if(loading||busy||!dirty||!supabase)return;
    const client=supabase;
    const timer=window.setTimeout(async()=>{
      setAutoSaving(true);
      const snapshot=JSON.stringify(layout);
      const {error}=await client.from('sheet_template_drafts').upsert({
        template_key:MOON_LAYOUT_KEY,fields:encodeMoonLayout(layout),
        updated_by:userId,updated_at:new Date().toISOString(),
      },{onConflict:'template_key'});
      if(!error && latestLayoutRef.current===snapshot)setSaved(snapshot);
      else if(error)setMessage('Ошибка автосохранения: '+error.message);
      setAutoSaving(false);
    },1800);
    return ()=>window.clearTimeout(timer);
  },[layout,loading,busy,dirty,userId]);
  function change(key: MoonLayoutKey, raw: string) {
    if(!raw.trim())return;
    const control = MOON_LAYOUT_CONTROLS.find(item => item.key === key);
    if (!control) return;
    if (control.min === undefined) {
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) setLayout(old => ({ ...old, [key]: raw }));
      return;
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    checkpoint();
    const bounded = number;
    setLayout(old => {
      if (key === 'titleFont') {
        const titleFont = Math.round(bounded);
        return {...old,titleFont,textStyles:{
          ...old.textStyles,pageTitle:{...old.textStyles.pageTitle,size:titleFont},
        }};
      }
      return { ...old, [key]: Math.round(bounded) };
    });
  }

  function changeTextStyle<K extends keyof MoonTextStyle>(field: K, value: MoonTextStyle[K]) {
    if(selectedElement && lockedElements.includes(selectedElement))return;
    checkpoint();
    setLayout(old => {
      const before = selectedElement ? {...old.textStyles[selectedTextGroup],...old.elementStyles[selectedElement]} : old.textStyles[selectedTextGroup];
      const updated = normalizeMoonTextStyle({...before,[field]:value}, before);
      
      return {
        ...old,
        ...(!selectedElement && selectedTextGroup === 'pageTitle' && field === 'size'
          ? {titleFont:updated.size} : {}),
        ...(selectedElement
          ? {elementStyles:{...old.elementStyles,[selectedElement]:updated}}
          : {textStyles:{...old.textStyles,[selectedTextGroup]:updated}}),
      };
    });
  }

  async function saveDraft(): Promise<boolean> {
    if (!supabase || busy || loading) return false;
    setBusy(true); setMessage('');
    try {
      const {error} = await supabase.from('sheet_template_drafts').upsert({
        template_key: MOON_LAYOUT_KEY, fields: encodeMoonLayout(layout),
        updated_by: userId, updated_at: new Date().toISOString(),
      }, { onConflict: 'template_key' });
      if (error) { setMessage('Ошибка сохранения: ' + error.message); return false; }
      setSaved(JSON.stringify(layout));
      setMessage('Черновик сохранён. На сайте всё ещё опубликована предыдущая версия.');
      return true;
    } finally { setBusy(false); }
  }
  async function publish() {
    const problems:string[]=[];
    if(!Number.isFinite(layout.pagePadding)||layout.pagePadding<0||layout.pagePadding>100)problems.push('Некорректные поля страницы');
    if(!Number.isFinite(layout.portraitWidth)||layout.portraitWidth<20||layout.portraitWidth>1000)problems.push('Некорректный размер портрета');
    for(const [key,style] of Object.entries(layout.elementStyles)){
      if(typeof style.size!=='number'||!Number.isFinite(style.size)||style.size<5||style.size>120)problems.push('Недопустимый размер текста: '+key);
    }
    if(problems.length){setMessage('Публикация остановлена: '+problems.join('; '));return;}
    if (!supabase || busy || !confirm('Опубликовать оформление Pr. Moon для всех пользователей?')) return;
    if (!(await saveDraft())) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.rpc('publish_sheet_template',{ p_template_key: MOON_LAYOUT_KEY });
      if (error) { setMessage('Не удалось опубликовать: ' + error.message); return; }
      const next = Number(data);
      setVersion(next); setVersions(old => [next,...old]);
      setMessage('Версия ' + next + ' опубликована. Оформление появится у пользователей после обновления листа.');
    } finally { setBusy(false); }
  }
  async function restoreVersion() {
    if (!supabase || !restore || busy) return;
    if (!confirm('Загрузить выбранную версию в редактор?')) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.from('sheet_template_history').select('fields')
        .eq('template_key',MOON_LAYOUT_KEY).eq('version', Number(restore)).single();
      if (error) { setMessage('Ошибка загрузки версии: ' + error.message); return; }
      setLayout(parseMoonLayout(data?.fields));
      setMessage('Версия восстановлена в редакторе. Для применения сначала сохрани черновик.');
    } finally { setBusy(false); }
  }
  function exit() {
    if (dirty && !confirm('Выйти без сохранения изменений оформления?')) return;
    onClose();
  }

  const frameKeys = ['portraitWidth','portraitShiftX','portraitShiftY'];
  const maskKeys = ['maskWidth','maskHeight','maskShiftX','maskShiftY'];
  const baseControls = MOON_LAYOUT_CONTROLS.filter(option =>
    !frameKeys.includes(option.key) && !maskKeys.includes(option.key));
  const frameControls = MOON_LAYOUT_CONTROLS.filter(option => frameKeys.includes(option.key));
  const maskControls = MOON_LAYOUT_CONTROLS.filter(option => maskKeys.includes(option.key));
  const renderControl = (option: typeof MOON_LAYOUT_CONTROLS[number]) => (
        <label key={option.key}>{option.title}
              {option.min === undefined
                ? <input type="color" disabled={busy || loading}
                    value={layout[option.key] as string}
                    onChange={e => change(option.key,e.target.value)}/>
                : <span className="moon-admin-value">
                    <input type="range"
                      min={isMoonPortraitShift(option.key)
                        ? Math.min(option.min!, (layout[option.key] as number) - 100) : option.min}
                      max={isMoonPortraitShift(option.key)
                        ? Math.max(option.max!, (layout[option.key] as number) + 100) : option.max}
                      step={option.step || 1} disabled={busy || loading}
                      value={layout[option.key] as number}
                      onChange={e => change(option.key,e.target.value)}/>
                    <input type="number" min={isMoonPortraitShift(option.key) ? undefined : option.min}
                      max={isMoonPortraitShift(option.key) ? undefined : option.max}
                      step={option.step || 1}
                      aria-label={option.title} disabled={busy || loading}
                      value={numberDrafts[option.key] ?? String(layout[option.key])}
                      onChange={e => setNumberDrafts(old=>({...old,[option.key]:e.target.value}))}
                      onBlur={()=>{
                        const raw=numberDrafts[option.key];
                        if(raw!==undefined && raw.trim() && Number.isFinite(Number(raw)))change(option.key,raw);
                        setNumberDrafts(old=>{const next={...old};delete next[option.key];return next;});
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
                    <small>{option.unit}</small>
                  </span>}
        </label>

  );

  return <main className="page moon-admin">
    <header className="moon-admin-toolbar">
      <button type="button" onClick={exit}><ArrowLeft size={17}/> К выбору листа</button>
      <h1>Редактор оформления Pr. Moon</h1>
      <div className="moon-admin-actions">
        <button type="button" disabled={busy || loading || !dirty} onClick={() => void saveDraft()}>
          <Save size={16}/> Сохранить черновик
        </button>
        <button type="button" className="moon-admin-publish" disabled={busy || loading} onClick={() => void publish()}>
          <UploadCloud size={16}/> Опубликовать
        </button>
      </div>
    </header>
    <p className="moon-admin-status" role="status">{loading ? 'Загрузка…' : message}{dirty ? ' · Не сохранено' : ''}</p>
    <div className="moon-admin-columns">
      <div className="moon-admin-preview" onClick={pickElement} onWheel={e=>{if(e.ctrlKey||e.shiftKey||e.altKey)return;setZoom(old=>Math.max(35,Math.min(250,old+(e.deltaY<0?5:-5))));}}>
        <div className="moon-admin-preview-scale" style={{zoom:zoom/100,width:device==='mobile'?390:device==='tablet'?768:undefined,maxWidth:'none'}}><ProjectMoonSheet key="moon-admin-preview" character={previewCharacter} previewMode
          layoutOverride={layout} onSave={async () => true} onClose={() => {}} onEditPortrait={() => {}} /></div>
      </div>
      <aside className="moon-admin-inspector">
        <div className="moon-admin-quick-actions">
          <button type="button" title="Отменить (Ctrl+Z)" disabled={!undo.length} onClick={undoOnce}><Undo2 size={17}/></button>
          <button type="button" title="Повторить (Ctrl+Y)" disabled={!redo.length} onClick={redoOnce}><Redo2 size={17}/></button>
          <button type="button" title="Уменьшить масштаб" onClick={()=>setZoom(old=>Math.max(35,old-10))}><ZoomOut size={17}/></button>
          <span>{zoom}%</span>
          <button type="button" title="Увеличить масштаб" onClick={()=>setZoom(old=>Math.min(250,old+10))}><ZoomIn size={17}/></button>
        </div>
        <div className="moon-admin-device-controls" role="group" aria-label="Размер предпросмотра">
          {(['desktop','tablet','mobile'] as const).map(mode=><button type="button" key={mode}
            aria-pressed={device===mode} onClick={()=>setDevice(mode)}>{mode==='desktop'?'Компьютер':mode==='tablet'?'Планшет':'Телефон'}</button>)}
        </div>
        <h2>Оформление HTML-листа</h2>
        <p className="moon-admin-autosave">{autoSaving?'Сохранение черновика…':dirty?'Изменения ожидают автосохранения':'Черновик сохранён'}</p>
        <div className="moon-admin-selection">
          <strong>{selectedElement?'Выбрано: '+selectedLabel:'Нажми на надпись в предпросмотре'}</strong>
          {selectedElement&&<>
            <button type="button" onClick={()=>setLockedElements(old=>old.includes(selectedElement)?old.filter(id=>id!==selectedElement):[...old,selectedElement])}>{lockedElements.includes(selectedElement)?'Разблокировать':'Заблокировать'}</button>
            <button type="button" onClick={resetIndividual}>Сбросить надпись</button>
            <button type="button" onClick={()=>setSelectedElement('')}>Общие стили</button>
          </>}
          <div><button type="button" onClick={copyStyle}>Копировать стиль</button>
          <button type="button" disabled={!styleClipboard} onClick={pasteStyle}>Вставить стиль</button></div>
        </div>
        <p>Изменяй параметры и смотри результат на всех четырёх страницах. Поля персонажей и их значения не затрагиваются.</p>
        <div className="moon-admin-controls">
          {baseControls.map(renderControl)}
        </div>
        <section className="moon-admin-portrait-settings" aria-label="Настройки рамки портрета">
          <h3>Рамка портрета</h3>
          <p>Ширина и смещение декоративной рамки. Маска и изображение регулируются отдельно.</p>
          <div className="moon-admin-controls">{frameControls.map(renderControl)}</div>
        </section>
        <section className="moon-admin-portrait-settings" aria-label="Настройки маски портрета">
          <h3>Маска и изображение</h3>
          <p>Отдельные ширина, высота и смещения. При изменении маски портрет и область нажатия перемещаются вместе с ней.</p>
          <div className="moon-admin-controls">{maskControls.map(renderControl)}</div>
          <button type="button" className="moon-admin-reset-mask" disabled={busy || loading}
            onClick={()=>{checkpoint();setLayout(old=>({...old,
              maskWidth:100,maskHeight:100,maskShiftX:0,maskShiftY:0,
            }));}}>Сбросить только маску</button>
        </section>

        <section className="moon-admin-typography" aria-label="Оформление текстовых блоков">
          <h3>Текстовые блоки</h3>
          <p>Выбери тип текста на листе и настрой его внешний вид. Изменения сразу видны в предпросмотре и не меняют содержимое персонажей.</p>
          <label>Какой текст редактировать?
            <select value={selectedTextGroup}
              onChange={e=>{setSelectedElement('');setSelectedTextGroup(e.target.value as MoonTextGroup);}}
              disabled={loading || busy}>
              {MOON_TEXT_GROUPS.map(group=><option key={group.key} value={group.key}>{group.title}</option>)}
            </select>
          </label>
          <div className="moon-admin-text-controls">
            {selectedElement&&<p className="moon-admin-element-hint">Размеры меняются только у выбранного блока. «Сбросить выбранный» возвращает исходный размер.</p>}
            <label>Размер шрифта
              <span className="moon-admin-value">
                <input type="range" min={selectedTextGroup === 'pageTitle' ? 20 : 7}
                  max={selectedTextGroup === 'pageTitle' ? 42 : 48} step={1}
                  value={currentTextStyle.size}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('size',Number(e.target.value))}/>
                <input type="number" min={selectedTextGroup === 'pageTitle' ? 20 : 7}
                  max={selectedTextGroup === 'pageTitle' ? 42 : 48} step={1}
                  value={currentTextStyle.size}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('size',Number(e.target.value))}/>
                <small>px</small>
              </span>
            </label>
            {selectedElement&&<>
              <label>Ширина текстового блока
                <span className="moon-admin-value">
                  <button type="button" aria-label="Уменьшить ширину блока" onClick={()=>changeTextStyle('boxWidth',Math.max(40,(currentTextStyle.boxWidth??300)-10))}>−</button>
                  <input type="number" min={40} max={1000} step={10}
                    value={currentTextStyle.boxWidth??''} placeholder="Авто"
                    disabled={loading||busy}
                    onChange={e=>changeTextStyle('boxWidth',Number(e.target.value))}/>
                  <button type="button" aria-label="Увеличить ширину блока" onClick={()=>changeTextStyle('boxWidth',Math.min(1000,(currentTextStyle.boxWidth??300)+10))}>+</button>
                  <small>px</small>
                </span>
              </label>
              <label>Высота текстового блока
                <span className="moon-admin-value">
                  <button type="button" aria-label="Уменьшить высоту блока" onClick={()=>changeTextStyle('boxHeight',Math.max(20,(currentTextStyle.boxHeight??80)-10))}>−</button>
                  <input type="number" min={20} max={900} step={10}
                    value={currentTextStyle.boxHeight??''} placeholder="Авто"
                    disabled={loading||busy}
                    onChange={e=>changeTextStyle('boxHeight',Number(e.target.value))}/>
                  <button type="button" aria-label="Увеличить высоту блока" onClick={()=>changeTextStyle('boxHeight',Math.min(900,(currentTextStyle.boxHeight??80)+10))}>+</button>
                  <small>px</small>
                </span>
              </label>
            </>}
            <label>Жирность
              <select value={currentTextStyle.weight}
                disabled={loading || busy}
                onChange={e=>changeTextStyle('weight',Number(e.target.value))}>
                {[100,200,300,400,500,600,700,800,900].map(weight=>
                  <option key={weight} value={weight}>{weight}{weight===400?' · обычный':weight===700?' · полужирный':weight===800?' · жирный':''}</option>)}
              </select>
            </label>
            <label>Шрифт
              <select value={currentTextStyle.family}
                disabled={loading || busy}
                onChange={e=>changeTextStyle('family',e.target.value as MoonTextStyle['family'])}>
                <option value="sans">Без засечек (как в PDF)</option>
                <option value="serif">С засечками</option>
                <option value="mono">Моноширинный</option>
              </select>
            </label>
            <label>Выравнивание
              <select value={currentTextStyle.align}
                disabled={loading || busy}
                onChange={e=>changeTextStyle('align',e.target.value as MoonTextStyle['align'])}>
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
              </select>
            </label>
            <label>Межбуквенный интервал
              <span className="moon-admin-value">
                <input type="range" min={-2} max={6} step={0.1}
                  value={currentTextStyle.letterSpacing}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('letterSpacing',Number(e.target.value))}/>
                <input type="number" min={-2} max={6} step={0.1}
                  value={currentTextStyle.letterSpacing}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('letterSpacing',Number(e.target.value))}/>
                <small>px</small>
              </span>
            </label>
            <label>Межстрочный интервал
              <span className="moon-admin-value">
                <input type="range" min={1} max={2.5} step={0.05}
                  value={currentTextStyle.lineHeight}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('lineHeight',Number(e.target.value))}/>
                <input type="number" min={1} max={2.5} step={0.05}
                  value={currentTextStyle.lineHeight}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('lineHeight',Number(e.target.value))}/>
              </span>
            </label>
            <div className="moon-admin-format-buttons" role="group" aria-label="Быстрое форматирование">
              <button type="button" aria-label="Жирный" title="Жирный" aria-pressed={currentTextStyle.weight>=700}
                disabled={loading||busy} onClick={()=>changeTextStyle('weight',currentTextStyle.weight>=700?400:700)}><Bold size={17}/></button>
              <button type="button" aria-label="Курсив" title="Курсив" aria-pressed={currentTextStyle.italic}
                disabled={loading||busy} onClick={()=>changeTextStyle('italic',!currentTextStyle.italic)}><Italic size={17}/></button>
              {([{align:'left',Icon:AlignLeft},{align:'center',Icon:AlignCenter},{align:'right',Icon:AlignRight}] as const).map(({align,Icon})=>
                <button key={align} type="button" aria-label={align} aria-pressed={currentTextStyle.align===align}
                  disabled={loading||busy} onClick={()=>changeTextStyle('align',align)}><Icon size={17}/></button>)}
            </div>
            <button type="button" className="moon-admin-reset-typography"
              disabled={loading || busy}
              onClick={()=>{checkpoint();setLayout(old=>{
                const defaults = cloneMoonTextStyles()[selectedTextGroup];
                return {
                  ...old,
                  ...(selectedTextGroup === 'pageTitle' ? {titleFont:26}:{}),
                  textStyles:{...old.textStyles,[selectedTextGroup]:defaults},
                };
              });}}>Сбросить оформление выбранного типа</button>
          </div>
        </section>
        <button type="button" className="moon-admin-reset" disabled={busy || loading}
          onClick={() => {if (confirm('Вернуть исходные размеры, шрифты и цвета листа?')) {checkpoint();setLayout({...DEFAULT_MOON_LAYOUT,textStyles:cloneMoonTextStyles()});}}}>
          <RotateCcw size={15}/> Исходное оформление
        </button>
        <hr/>
        <h3>Сравнение с опубликованным</h3>
        <p>{publishedLayout ? (JSON.stringify(publishedLayout)===JSON.stringify(layout)
          ? 'Черновик совпадает с опубликованной версией.'
          : 'Черновик отличается от опубликованной версии. Можно сравнить параметры или восстановить публикацию.') : 'Публикация ещё не загружена.'}</p>
        <button type="button" disabled={!publishedLayout||busy} onClick={()=>{
          if(!publishedLayout||!confirm('Загрузить опубликованное оформление в черновик?'))return;
          checkpoint();setLayout(structuredClone(publishedLayout));
        }}>Вернуть опубликованное оформление</button>
        <h3>История оформления</h3>
        <p>Опубликованная версия: {version || 'нет'}. Черновик виден только администратору.</p>
        <label>Загрузить версию
          <select value={restore} disabled={busy || loading} onChange={e => setRestore(e.target.value)}>
            <option value="">Выбери версию</option>
            {versions.map(v => <option key={v} value={v}>Версия {v}</option>)}
          </select>
        </label>
        <button type="button" disabled={!restore || busy || loading} onClick={() => void restoreVersion()}>
          <Check size={15}/> Загрузить
        </button>
      </aside>
    </div>
  </main>;
}

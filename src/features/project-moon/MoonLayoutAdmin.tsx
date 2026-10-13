import { useEffect, useState } from 'react';
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
  const [saved, setSaved] = useState(JSON.stringify(DEFAULT_MOON_LAYOUT));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [versions, setVersions] = useState<number[]>([]);
  const [restore, setRestore] = useState('');
  const dirty = saved !== JSON.stringify(layout);
  const [zoom,setZoom]=useState(100);
  const [undo,setUndo]=useState<MoonLayout[]>([]);
  const [redo,setRedo]=useState<MoonLayout[]>([]);
  const [numericDrafts,setNumericDrafts]=useState<Record<string,string>>({});
  const recordChange=(next:MoonLayout)=>{
    setUndo(old=>[...old.slice(-49),layout]);
    setRedo([]);
    setLayout(next);
  };
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

  function change(key: MoonLayoutKey, raw: string) {
    const control = MOON_LAYOUT_CONTROLS.find(item => item.key === key);
    if (!control) return;
    if (control.min === undefined) {
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) setLayout(old => ({ ...old, [key]: raw }));
      return;
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
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
    setLayout(old => {
      const before = old.textStyles[selectedTextGroup];
      const updated = normalizeMoonTextStyle({...before,[field]:value}, before);
      
      return {
        ...old,
        ...(selectedTextGroup === 'pageTitle' && field === 'size'
          ? {titleFont:updated.size} : {}),
        textStyles:{...old.textStyles,[selectedTextGroup]:updated},
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
                      aria-label={option.title} disabled={busy || loading} value={layout[option.key] as number}
                      onChange={e => change(option.key,e.target.value)}/>
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
      <div className="moon-admin-preview" onWheel={e=>{if(e.ctrlKey||e.shiftKey||e.altKey)return;setZoom(old=>Math.max(35,Math.min(250,old+(e.deltaY<0?5:-5))));}}>
        <div className="moon-admin-preview-scale" style={{zoom:zoom/100}}><ProjectMoonSheet key="moon-admin-preview" character={previewCharacter} previewMode
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
        <h2>Оформление HTML-листа</h2>
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
            onClick={()=>setLayout(old=>({...old,
              maskWidth:100,maskHeight:100,maskShiftX:0,maskShiftY:0,
            }))}>Сбросить только маску</button>
        </section>

        <section className="moon-admin-typography" aria-label="Оформление текстовых блоков">
          <h3>Текстовые блоки</h3>
          <p>Выбери тип текста на листе и настрой его внешний вид. Изменения сразу видны в предпросмотре и не меняют содержимое персонажей.</p>
          <label>Какой текст редактировать?
            <select value={selectedTextGroup}
              onChange={e=>setSelectedTextGroup(e.target.value as MoonTextGroup)}
              disabled={loading || busy}>
              {MOON_TEXT_GROUPS.map(group=><option key={group.key} value={group.key}>{group.title}</option>)}
            </select>
          </label>
          <div className="moon-admin-text-controls">
            <label>Размер шрифта
              <span className="moon-admin-value">
                <input type="range" min={selectedTextGroup === 'pageTitle' ? 20 : 7}
                  max={selectedTextGroup === 'pageTitle' ? 42 : 48} step={1}
                  value={layout.textStyles[selectedTextGroup].size}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('size',Number(e.target.value))}/>
                <input type="number" min={selectedTextGroup === 'pageTitle' ? 20 : 7}
                  max={selectedTextGroup === 'pageTitle' ? 42 : 48} step={1}
                  value={layout.textStyles[selectedTextGroup].size}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('size',Number(e.target.value))}/>
                <small>px</small>
              </span>
            </label>
            <label>Жирность
              <select value={layout.textStyles[selectedTextGroup].weight}
                disabled={loading || busy}
                onChange={e=>changeTextStyle('weight',Number(e.target.value))}>
                {[100,200,300,400,500,600,700,800,900].map(weight=>
                  <option key={weight} value={weight}>{weight}{weight===400?' · обычный':weight===700?' · полужирный':weight===800?' · жирный':''}</option>)}
              </select>
            </label>
            <label>Шрифт
              <select value={layout.textStyles[selectedTextGroup].family}
                disabled={loading || busy}
                onChange={e=>changeTextStyle('family',e.target.value as MoonTextStyle['family'])}>
                <option value="sans">Без засечек (как в PDF)</option>
                <option value="serif">С засечками</option>
                <option value="mono">Моноширинный</option>
              </select>
            </label>
            <label>Выравнивание
              <select value={layout.textStyles[selectedTextGroup].align}
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
                  value={layout.textStyles[selectedTextGroup].letterSpacing}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('letterSpacing',Number(e.target.value))}/>
                <input type="number" min={-2} max={6} step={0.1}
                  value={layout.textStyles[selectedTextGroup].letterSpacing}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('letterSpacing',Number(e.target.value))}/>
                <small>px</small>
              </span>
            </label>
            <label>Межстрочный интервал
              <span className="moon-admin-value">
                <input type="range" min={1} max={2.5} step={0.05}
                  value={layout.textStyles[selectedTextGroup].lineHeight}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('lineHeight',Number(e.target.value))}/>
                <input type="number" min={1} max={2.5} step={0.05}
                  value={layout.textStyles[selectedTextGroup].lineHeight}
                  disabled={loading || busy}
                  onChange={e=>changeTextStyle('lineHeight',Number(e.target.value))}/>
              </span>
            </label>
            <div className="moon-admin-format-buttons" role="group" aria-label="Быстрое форматирование">
              <button type="button" aria-label="Жирный" title="Жирный" aria-pressed={layout.textStyles[selectedTextGroup].weight>=700}
                disabled={loading||busy} onClick={()=>changeTextStyle('weight',layout.textStyles[selectedTextGroup].weight>=700?400:700)}><Bold size={17}/></button>
              <button type="button" aria-label="Курсив" title="Курсив" aria-pressed={layout.textStyles[selectedTextGroup].italic}
                disabled={loading||busy} onClick={()=>changeTextStyle('italic',!layout.textStyles[selectedTextGroup].italic)}><Italic size={17}/></button>
              {([{align:'left',Icon:AlignLeft},{align:'center',Icon:AlignCenter},{align:'right',Icon:AlignRight}] as const).map(({align,Icon})=>
                <button key={align} type="button" aria-label={align} aria-pressed={layout.textStyles[selectedTextGroup].align===align}
                  disabled={loading||busy} onClick={()=>changeTextStyle('align',align)}><Icon size={17}/></button>)}
            </div>
            <button type="button" className="moon-admin-reset-typography"
              disabled={loading || busy}
              onClick={()=>setLayout(old=>{
                const defaults = cloneMoonTextStyles()[selectedTextGroup];
                return {
                  ...old,
                  ...(selectedTextGroup === 'pageTitle' ? {titleFont:26}:{}),
                  textStyles:{...old.textStyles,[selectedTextGroup]:defaults},
                };
              })}>Сбросить оформление выбранного типа</button>
          </div>
        </section>
        <button type="button" className="moon-admin-reset" disabled={busy || loading}
          onClick={() => {if (confirm('Вернуть исходные размеры, шрифты и цвета листа?')) setLayout({...DEFAULT_MOON_LAYOUT,textStyles:cloneMoonTextStyles()});}}>
          <RotateCcw size={15}/> Исходное оформление
        </button>
        <hr/>
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

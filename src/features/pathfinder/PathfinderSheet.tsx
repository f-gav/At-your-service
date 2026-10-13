import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Settings2, BookOpen, X, Files, FileDown } from 'lucide-react';
import AutoSaveStatus from '../../lib/AutoSaveStatus';
import {exportRenderedSheetPdf} from '../../lib/sheet-pdf';
import '../../lib/sheet-pdf.css';
import {useAutoSave} from '../../lib/use-auto-save';
import {characterDraftKey,recoverLocalDraft} from '../../lib/local-drafts';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import { initialSheetValues, persistSheetValues } from './sheet-values';
import type { FieldValue, SheetValues } from './sheet-values';
import { supabase } from '../../lib/supabase';
import { DEFAULT_FIELDS, cloneFields, validFields, withEquipmentNumberFields, withClassDcNumericBonus, withMagicTraditionHalfCircles } from './editor-schema';
import { withWeaponSheetFields } from './weapon-fields';
import ToggleVisual from './ToggleVisual';
import DyingSkulls from './DyingSkulls';
import RankSelect from './RankSelect';
import RichField from './RichField';
import {spellTableSpan} from './spell-table-spoilers';
import { sanitizeSignedNumericInput } from './numeric-input';
import DynamicAdvancement from './DynamicAdvancement';
import { isAdvancementField, advancementLevelCount, addAdvancementLevel, removeAdvancementLevel } from './advancement-model';
import { calculateCore, isAutomatic, isCoreComputedField, RANK_FIELDS, readRank } from './rules-core';
import {calculateSpellcasting,isSpellcastingConfigured,isSpellcastingComputedField,setSpellcastingProficiency} from './rules-spellcasting';
import SpellcastingDialog from './SpellcastingDialog';
import SpellGrimoire,{PF_SPELL_MODE,PF_SPELL_SELECTION,PF_SPELL_TRADITIONS,PF_SPELL_CLASSES,readSavedSpells,selectedTraditions,selectedClasses,loadPfSpellViews,spellCast} from './SpellGrimoire';
import type {SpellView} from '../spell-library/catalog';
import PageSettingsDialog from './PageSettingsDialog';
import OptionalNotesPage from './OptionalNotesPage';
import {PF_PAGE_ORDER_KEY,PF_NOTES_ENABLED_KEY,PAGE_LABELS,parsePageOrder,notesPageEnabled,visiblePageOrder,serializePageOrder} from './page-order';
import type {PfPageId} from './page-order';
import { calculateNativeCombat, isNativeCombatComputedField, isNativeWeaponAttackField, isClassDcConfigured } from './rules-combat';
import { formulaDisplayValue } from './formula-display';
import type { EditableField } from './editor-schema';
import { fieldBox, PDF_HEIGHT, PDF_WIDTH } from './layout';
import PortraitImage from '../portrait/PortraitImage';
import type { CropFrame } from '../portrait/crop';
import './PathfinderSheet.css';

const PAGE_TITLES = ['Характеристики', 'Способности и снаряжение', 'Заметки и действия', 'Заклинания'];

/**
 * The four PDF pages are immutable high-resolution images.
 * Interactive fields and their values are separate from artwork, allowing
 * future rules engines and layout revisions without migrating saved data.
 */
export default function PathfinderSheet({
  character,
  onSave,
  onClose,
  portraitUrl,
  portraitFrame,
  onEditPortrait,
  autoExport=false,
  onAutoExportComplete,
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
  portraitUrl?: string;
  portraitFrame?: CropFrame;
  onEditPortrait: () => void;
  autoExport?: boolean;
  onAutoExportComplete?: () => void;
}) {
  const draftKey=characterDraftKey(character.user_id,character.id);
  const pdfRoot=useRef<HTMLElement>(null);
  const pdfInFlight=useRef(false);
  const pdfAutoStarted=useRef(false);
  const [exportingPdf,setExportingPdf]=useState(false);
  const [pdfError,setPdfError]=useState('');
  async function exportPdf(){
    if(pdfInFlight.current||!pdfRoot.current)return;
    pdfInFlight.current=true;setExportingPdf(true);setPdfError('');
    try{await exportRenderedSheetPdf(pdfRoot.current,String(values.name??character.name),'pf2e');}
    catch(cause){setPdfError(cause instanceof Error?cause.message:'Ошибка экспорта PDF.');}
    finally{
      pdfInFlight.current=false;setExportingPdf(false);
      if(autoExport)onAutoExportComplete?.();
    }
  }
  useEffect(()=>{
    if(!autoExport){pdfAutoStarted.current=false;return;}
    if(pdfAutoStarted.current)return;
    pdfAutoStarted.current=true;
    const timer=window.setTimeout(()=>{void exportPdf();},600);
    return ()=>window.clearTimeout(timer);
  },[autoExport]);


  const [serverBaseline]=useState(()=>JSON.stringify(initialSheetValues(character.details,character.name)));
  const [values,setValues]=useState<SheetValues>(()=>{
    const original=initialSheetValues(character.details,character.name);
    const recovered=recoverLocalDraft(draftKey,JSON.stringify(original));
    if(!recovered)return original;
    try {
      const parsed:unknown=JSON.parse(recovered);
      if(parsed && typeof parsed==='object' && !Array.isArray(parsed))
        return {...original,...parsed as SheetValues};
    } catch { /* Ignore an invalid local draft. */ }
    return original;
  });
  const [templateFields,setTemplateFields] = useState<EditableField[]>(()=>cloneFields(DEFAULT_FIELDS));
  // Page presentation and optional notes belong to this character, not the
  // global admin PDF template. Hidden notes remain saved in the character.
  const notesEnabled=notesPageEnabled(values[PF_NOTES_ENABLED_KEY]);
  const pageOrder=useMemo(()=>parsePageOrder(values[PF_PAGE_ORDER_KEY]),[values[PF_PAGE_ORDER_KEY]]);
  const visiblePages=useMemo(()=>visiblePageOrder(pageOrder,notesEnabled),[pageOrder,notesEnabled]);
  useEffect(() => {
    if(!supabase)return;
    let active=true;
    void supabase.from('sheet_templates').select('fields').eq('template_key','pf2e').maybeSingle().then(({data,error})=>{
      if(active && !error && validFields(data?.fields)) setTemplateFields(withMagicTraditionHalfCircles(withClassDcNumericBonus(withWeaponSheetFields(withEquipmentNumberFields(cloneFields(data.fields))))));
    });
    return()=>{active=false;};
  },[]);
  // Do not silently reinterpret a pre-existing sheet. It stays manual until opted in.
  const legacyHasValues = useMemo(() => {
    const stored = character.details.pathfinderSheet;
    return !!stored && typeof stored === 'object' && !Array.isArray(stored)
      && Object.keys(stored).some(key => key !== 'name' && key !== 'schemaVersion');
  }, [character.details]);
  const automatic = isAutomatic(values, legacyHasValues);
  const spellcastingConfigured=isSpellcastingConfigured(values);
  // AC is always the sum of the three editable PDF-strip cells, independent of
  // the optional auto-rules mode for skills, saves and other derived values.
  const computed = useMemo<Record<string,string>>(() => {
    const combat = calculateNativeCombat(values);
    const spellcasting=calculateSpellcasting(values);
    return automatic ? { ...calculateCore({ ...values, ...combat }), ...combat, ...spellcasting }
      : {...Object.fromEntries(Object.entries(combat).filter(([id]) =>
          id === 'armor_class' || id === 'class_dc' || isNativeWeaponAttackField(id))),...spellcasting};
  }, [automatic, values]);
  const displayValues = useMemo(() => ({ ...values, ...computed }), [values, computed]);
  function setAutomatic(enabled: boolean) {
    if (enabled && !window.confirm('Включить автоматические расчёты PF2e? Они изменят итоги навыков, спасбросков, Восприятия и порог поломки щита. КД всегда считается по плашке: 10 + Ловкость + Умение + Предмет. Ручные итоги заменятся формулами, а исходные значения сохранятся.')) return;
    setValues(prev => ({ ...prev, rulesMode: enabled ? 'auto' : 'manual' }));
  }
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [pageSettingsOpen,setPageSettingsOpen] = useState(false);
  const [spellSettingsOpen,setSpellSettingsOpen] = useState(false);
  const [grimoireOpen,setGrimoireOpen]=useState(false);
  const [spellViews,setSpellViews]=useState<SpellView[]>([]);
  const spellMode=values[PF_SPELL_MODE]==='text'?'text':'library';
  const savedSpells=useMemo(()=>readSavedSpells(values[PF_SPELL_SELECTION]),[values[PF_SPELL_SELECTION]]);
  const availableTraditions=useMemo(()=>selectedTraditions(values[PF_SPELL_TRADITIONS]),[values[PF_SPELL_TRADITIONS]]);
  const availableClasses=useMemo(()=>selectedClasses(values[PF_SPELL_CLASSES]),[values[PF_SPELL_CLASSES]]);
  useEffect(()=>{
    if(spellMode!=='library')return;
    const controller=new AbortController();
    void loadPfSpellViews(controller.signal).then(setSpellViews).catch(()=>{});
    return()=>controller.abort();
  },[spellMode]);
  const grimoireColumns=useMemo(()=>{
    const prepared=savedSpells.filter(x=>x.prepared).map(x=>spellViews.find(v=>v.id===x.id)).filter((x):x is SpellView=>!!x);
    const cantrips=prepared.filter(x=>x.spell.rank===0&&x.spell.kind==='cantrip');
    const focus=prepared.filter(x=>x.spell.kind==='focus');
    const rituals=prepared.filter(x=>x.spell.kind==='ritual');
    const innate=prepared.filter(x=>x.spell.kind==='special');
    const regular=prepared.filter(x=>x.spell.rank>0&&!['focus','ritual','special'].includes(x.spell.kind));
    return {cantrips,focus,rituals,innate,left:regular.filter((_,i)=>i%2===0),right:regular.filter((_,i)=>i%2===1)};
  },[savedSpells,spellViews]);
  const [navigationHelp,setNavigationHelp] = useState<boolean>(()=>{
    try{return window.localStorage.getItem('ays-pf2e-navigation-help')==='1';}
    catch{return false;}
  });
  const [activePage,setActivePage] = useState<PfPageId>('1');
  useEffect(()=>{
    try{window.localStorage.setItem('ays-pf2e-navigation-help',navigationHelp?'1':'0');}
    catch{ /* Keep page navigation available during this session. */ }
  },[navigationHelp]);
  useEffect(()=>{
    if(!navigationHelp)return;
    let frame=0;
    const update=()=>{
      frame=0;
      // The current page is determined by VISUAL order rather than original
      // PDF page number. This remains correct after notes/page reordering.
      let active:PfPageId=visiblePages[0]??'1';
      for(const page of visiblePages){
        const rect=document.getElementById('pf-sheet-page-'+page)?.getBoundingClientRect();
        if(rect&&rect.top<=window.innerHeight*.33)active=page;
      }
      setActivePage(active);
    };
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    return()=>{
      window.removeEventListener('scroll',onScroll);
      window.removeEventListener('resize',onScroll);
      if(frame)cancelAnimationFrame(frame);
    };
  },[navigationHelp,visiblePages]);
  function navigatePage(page:PfPageId){
    document.getElementById('pf-sheet-page-'+page)?.scrollIntoView({
      block:'start',
      behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
    });
    setActivePage(page);
  }
  const [monochrome,setMonochrome] = useState<boolean>(() => {
    try { return window.localStorage.getItem('ays-pf2e-monochrome') === '1'; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('ays-pf2e-monochrome', monochrome?'1':'0'); }
    catch { /* storage can be blocked; use session preference */ }
  }, [monochrome]);
  useEffect(() => {
    if(!settingsOpen)return;
    const closeOutside=(event:PointerEvent)=>{
      if(event.target instanceof Element && !event.target.closest('.pf-settings-area'))setSettingsOpen(false);
    };
    const closeEsc=(event:KeyboardEvent)=>{if(event.key==='Escape')setSettingsOpen(false);};
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('keydown',closeEsc);
    return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEsc);};
  }, [settingsOpen]);
  const [focusedFormulaField,setFocusedFormulaField] = useState<string | null>(null);
  // Do not lock inputs while the background save is running. Write requests
  // are serialized in useAutoSave, and each acknowledges only its own snapshot.
  const editLocked=false;
  const auto=useAutoSave({
    snapshot:JSON.stringify(values),initialSnapshot:serverBaseline,draftKey,
    persist:async serialized=>{
      const captured=JSON.parse(serialized) as SheetValues;
      const cleanName=normalizedName(String(captured.name??''));
      if(!cleanName)throw new Error('Укажи имя персонажа на первой странице.');
      // Recalculate derived values from the EXACT snapshot being persisted,
      // not from a newer render while a previous cloud request is pending.
      const isAuto=isAutomatic(captured,legacyHasValues);
      const spellActive=isSpellcastingConfigured(captured);
      const combat=calculateNativeCombat(captured);
      const spells=calculateSpellcasting(captured);
      const derived=isAuto
        ? {...calculateCore({...captured,...combat}),...combat,...spells}
        : {...Object.fromEntries(Object.entries(combat).filter(([id])=>
            id==='armor_class'||id==='class_dc'||isNativeWeaponAttackField(id))),...spells};
      const stored={...captured};
      for(const key of Object.keys(stored)) {
        if((key==='armor_class'||(key==='class_dc'&&isClassDcConfigured(captured))
          ||(spellActive&&isSpellcastingComputedField(key))
          ||(isAuto&&key!=='class_dc'&&(isCoreComputedField(key)
            ||(isNativeCombatComputedField(key)&&!isNativeWeaponAttackField(key)))))
          &&!(key in derived))stored[key]='';
      }
      Object.assign(stored,derived);
      return onSave(character.id,cleanName,persistSheetValues(character.details,stored,cleanName));
    },
  });
  const {error}=auto;

  function change(id: string, value: FieldValue) {
    if(spellcastingConfigured && (id==='spell_attack_rank'||id==='spell_dc_rank') && typeof value==='string'){
      setValues(previous=>setSpellcastingProficiency(previous,Number(value)));
      return;
    }
    const mark=/^weapon_([1-5])_damage_(bludgeoning|piercing|slashing)$/.exec(id);
    if (mark && value === true) {
      // The printed D/K/R circles describe the selected damage type of this
      // Strike. A versatile weapon can switch before the next Strike.
      setValues(previous=>{
        const next={...previous};
        for (const type of ['bludgeoning','piercing','slashing'])
          next['weapon_'+mark[1]+'_damage_'+type]=type===mark[2];
        return next;
      });
      return;
    }
    setValues(previous => previous[id] === value ? previous : { ...previous, [id]: value });
  }


  function changeSpellRank(rank:number) {
    setValues(previous=>setSpellcastingProficiency(previous,rank));
  }
  function setNotesPageEnabled(enabled:boolean){
    setValues(previous=>({...previous,[PF_NOTES_ENABLED_KEY]:enabled}));
  }
  function setPageOrder(order:PfPageId[]){
    const serialized=serializePageOrder(order);
    setValues(previous=>previous[PF_PAGE_ORDER_KEY]===serialized?previous:{
      ...previous,[PF_PAGE_ORDER_KEY]:serialized,
    });
  }

  async function goBack() {
    if(!(await auto.saveNow()))return; // no silent exit while changes remain local
    onClose();
  }

  function renderField(field: EditableField) {
    const box = fieldBox(field);
    const style: CSSProperties = {
      left: `${100 * box.x / PDF_WIDTH}%`,
      top: `${100 * box.y / PDF_HEIGHT}%`,
      width: `${100 * box.w / PDF_WIDTH}%`,
      height: `${100 * box.h / PDF_HEIGHT}%`,
      fontFamily: field.fontFamily || undefined,
      fontSize: field.fontSize ? (100*field.fontSize/PDF_WIDTH)+'cqw' : undefined,
      fontWeight: field.fontWeight || undefined,
      fontStyle: field.fontStyle || undefined,
      textDecoration: field.textUnderline ? 'underline' : undefined,
      textAlign: field.textAlign || undefined,
      color: field.color || undefined,
      padding: field.paddingX !== undefined || field.paddingY !== undefined ? ((100*(field.paddingY??0)/PDF_WIDTH)+'cqw '+(100*(field.paddingX??2)/PDF_WIDTH)+'cqw') : undefined,
    };
    const id = `pf-${field.id}`;
    const value = (field.id === 'armor_class' || (field.id === 'class_dc' && isClassDcConfigured(values)) || (spellcastingConfigured && isSpellcastingComputedField(field.id)) || (automatic && field.id !== 'class_dc' && (isCoreComputedField(field.id) || (isNativeCombatComputedField(field.id) && !isNativeWeaponAttackField(field.id))))) && !(field.id in computed)
      ? '' : displayValues[field.id];
    // These skulls are already printed on the PDF; each one is its own
    // directly clickable hit area. Reuse the original numeric "dying" value
    // so previously saved characters and JSON exports need no migration.
    if (field.id === 'dying') {
      return <DyingSkulls key={field.id} style={style} value={values.dying}
        disabled={editLocked} onChange={next=>change('dying',next)}/>;
    }
    if (RANK_FIELDS.has(field.id)) {
      return <RankSelect key={field.id} id={id} label={field.label}
        rank={readRank(values[field.id]) ?? 0} style={style}
        disabled={editLocked} onChange={rank => change(field.id, String(rank))}/>;
    }
    const computedField = field.id === 'armor_class' || field.id === 'class_dc' || isNativeWeaponAttackField(field.id) || (spellcastingConfigured && isSpellcastingComputedField(field.id)) || (automatic && (isCoreComputedField(field.id) || isNativeCombatComputedField(field.id)));
    if (field.kind === 'toggle') {
      return <label key={field.id} className="pf-field pf-field-toggle" style={style}>
        <input id={id} type="checkbox" checked={value === true}
          onChange={event => change(field.id, event.target.checked)}
          aria-label={field.label} disabled={editLocked} />
        <ToggleVisual field={field} checked={value === true}/>
      </label>;
    }
    const shared = {
      id,
      'aria-label': field.label,
      value: String(value ?? ''),
      maxLength: field.maxlen,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!computedField) change(field.id,
          (field.kind==='number'||field.kind==='counter')
            ? sanitizeSignedNumericInput(event.target.value)
            : event.target.value);
      },
      readOnly: computedField,
      disabled: editLocked,
    };
    if (field.kind === 'select') {
      const options = field.options ?? [];
      const current = String(value ?? '');
      const legacy = Boolean(current) && !options.includes(current);
      return <select key={field.id} id={id} aria-label={field.label}
        className={`pf-field pf-field-text pf-field-select${field.underline ? " pf-field-underline" : ""}`} style={style} value={current}
        disabled={editLocked} onChange={event => change(field.id,event.target.value)}>
        <option value="">—</option>
        {legacy && <option value={current}>{current}</option>}
        {options.map(option=><option key={option} value={option}>{option}</option>)}
      </select>;
    }
    const narrow = field.w < 40 ? ' pf-field-narrow' : '';
    const tiny = field.w < 20 ? ' pf-field-tiny' : '';
    const spellColumns=/^(cantrip_(names|actions|prepared)|spellbook_(left|right)_(names|actions|ranks|prepared)|focus_(spells|actions)|innate_(spells|actions|frequency)|rituals_(left|right)_(name|rank|cost))$/.test(field.id);
    if(field.kind==='long'&&spellColumns&&spellMode==='library'){
      const fieldId=field.id;
      const list:SpellView[]=fieldId.startsWith('cantrip_')?grimoireColumns.cantrips:
        fieldId.startsWith('spellbook_left_')?grimoireColumns.left:
        fieldId.startsWith('spellbook_right_')?grimoireColumns.right:
        fieldId.startsWith('focus_')?grimoireColumns.focus:
        fieldId.startsWith('innate_')?grimoireColumns.innate:
        fieldId.startsWith('rituals_left_')?grimoireColumns.rituals.filter((_,i)=>i%2===0):
        grimoireColumns.rituals.filter((_,i)=>i%2===1);
      const text=(spell:SpellView)=>fieldId.endsWith('_actions')?spellCast(spell):
        fieldId.endsWith('_ranks')||fieldId.endsWith('_rank')?String(spell.spell.rank):
        fieldId.endsWith('_prepared')?'✓':
        fieldId.endsWith('_frequency')||fieldId.endsWith('_cost')?'—':spell.name;
      return <button key={fieldId} type="button" className="pf-spell-library-field pf-field"
        style={style} disabled={editLocked} onClick={()=>setGrimoireOpen(true)}
        title="Открыть гримуар для выбора заклинаний" aria-label={field.label+', выбрать заклинания'}>
        {list.map(spell=><span key={spell.id}>{text(spell)}</span>)}
      </button>;
    }
    if (field.kind === 'long') {
      const tableSpan = spellTableSpan(field, templateFields);
      const richStyle = tableSpan ? {
        ...style,
        '--pf-spell-span-width': `${100*tableSpan.width/PDF_WIDTH}cqw`,
        '--pf-spell-span-offset': `${100*tableSpan.offset/PDF_WIDTH}cqw`,
        '--pf-spell-heading-columns': tableSpan.tracks.length===4
          // Measured against the printed header dividers, not editable overlay field boxes.
          ? '48% 23.5% 13.5% 15%'
          : tableSpan.tracks.map(w=>`${(100*w/tableSpan.width).toFixed(4)}%`).join(' '),
      } as CSSProperties : style;
      return <RichField key={field.id} id={id} label={field.label}
        className={`pf-field pf-field-text pf-field-long${narrow}${tiny}${field.underline ? " pf-field-underline" : ""}${tableSpan ? ' pf-spell-table-rich' : ''}`}
        style={richStyle} spellColumns={tableSpan?.columns} value={String(value??'')} resourceContext={values} disabled={editLocked||computedField}
        onChange={next=>change(field.id,next)}/>;
    }
    const numeric = field.kind === 'number' || field.kind === 'counter';
    return <input
      key={field.id}
      className={`pf-field pf-field-text${numeric ? ' pf-field-number' : ''}${narrow}${tiny}${field.id === 'name' ? ' pf-field-character-name' : ''}${(field.id==='spell_attack'||field.id==='spell_dc')?' pf-field-spell-open-settings':''}${field.underline ? ' pf-field-underline' : ''}`}
      style={style}
      {...shared}
      value={formulaDisplayValue(field.id, String(value ?? ''), !computedField && focusedFormulaField === field.id)}
      onClick={(field.id==='spell_attack'||field.id==='spell_dc')?()=>setSpellSettingsOpen(true):undefined}
      onFocus={() => setFocusedFormulaField(field.id)}
      onBlur={() => setFocusedFormulaField(current => current === field.id ? null : current)}
      type="text"
      inputMode={numeric && !computedField && !/^weapon_[1-5]_damage$/.test(field.id) ? 'numeric' : 'text'}
      aria-description={computedField ? 'Автоматический расчёт — исходные параметры изменяются непосредственно в соседних полях листа' : undefined}
    />;
  }

  function renderPage(page: number) {
    const pageFields = templateFields.filter(field => field.page===page && (page!==2 || !isAdvancementField(field.id)));
    const isAdvancementPage=page===2;

    const artwork = <>
      <img
        src={`${import.meta.env.BASE_URL}pathfinder/page-${page}.webp?v=3`}
        width="3005"
        height="3912"
        loading={page === 1 ? 'eager' : 'lazy'}
        decoding="async"
        alt={`Бланк Pathfinder 2e, страница ${page}: ${PAGE_TITLES[page - 1]}`}
        draggable={false}
      />
      {page===3 && <button type="button" className="pf-portrait-button"
        aria-label="Загрузить или сменить портрет персонажа"
        onClick={onEditPortrait}>
          <PortraitImage url={portraitUrl || `${import.meta.env.BASE_URL}pathfinder/portrait-placeholder.webp`}
            frame={portraitUrl?portraitFrame:undefined} />
        </button>}
      {pageFields.map(renderField)}
      {page===4&&<button type="button" className="pf-spell-grimoire-trigger"
        disabled={editLocked||spellMode==='text'} onClick={()=>setGrimoireOpen(true)}
        aria-label="Открыть гримуар" title={spellMode==='text'?'Недоступно в режиме текста':'Выбор заклинаний'}><BookOpen size={15}/></button>}
      {page===4&&<button type="button" className="pf-spell-settings-trigger"
        disabled={editLocked} onClick={()=>setSpellSettingsOpen(true)}
        aria-label="Настройки заклинаний" title="Настройки заклинаний">
        <Settings2 size={15}/>
      </button>}
      <div className="pf-page-footer-mask" aria-hidden="true" />
    </>;
    return <section key={page} id={`pf-sheet-page-${page}`} className={`pf-sheet-page${isAdvancementPage ? " pf-sheet-page-advancement" : ""}`} aria-label={`Страница ${page}: ${PAGE_TITLES[page - 1]}`}>
      {isAdvancementPage
        ? <div className="pf-advancement-fixed-art">{artwork}</div>
        : artwork}
      {isAdvancementPage && <DynamicAdvancement values={values}
        count={advancementLevelCount(values)} disabled={editLocked}
        pageArtUrl={`${import.meta.env.BASE_URL}pathfinder/page-2.webp?v=3`}
        onValueChange={(id,value)=>change(id,value)}
        onAdd={()=>setValues(old=>addAdvancementLevel(old))}
        onRemove={level=>setValues(old=>removeAdvancementLevel(old,level))}/>}
    </section>;
  }

  return <main className="page pf-editor" ref={pdfRoot}>
    <div className="pf-toolbar">
      <button type="button" className="text-button" onClick={() => void goBack()} disabled={editLocked}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <div className="pf-toolbar-heading">
        <h1 className="pf-minimal-title">Лист персонажа PF2e</h1>
      </div>
      <div className="pf-toolbar-right">
        <AutoSaveStatus phase={auto.phase} error={error} savedAt={auto.savedAt} onRetry={auto.retry}/>
        <button type="button" className="sheet-pdf-export-tab" disabled={exportingPdf}
          onClick={()=>void exportPdf()} title="Скачать заполненный лист в PDF"
          aria-label="Экспорт листа Pathfinder в PDF">
          <FileDown size={18}/><span>{exportingPdf?'Создаю…':'PDF'}</span>
        </button>
        <div className="pf-settings-area">
          <button type="button" className="pf-settings-button" aria-expanded={settingsOpen}
            aria-controls="pf-settings-options" aria-label="Настройки листа"
            onClick={()=>setSettingsOpen(current=>!current)}>
            <Settings2 size={17} /> <span>Настройки</span>
          </button>
          {settingsOpen && <div id="pf-settings-options" className="pf-settings-popover" role="group" aria-label="Настройки листа">
            <label className="pf-settings-option">
              <input type="checkbox" checked={monochrome} onChange={event=>setMonochrome(event.target.checked)}/>
              Черно-белый лист
            </label>
            <label className="pf-settings-option">
              <input type="checkbox" checked={automatic} onChange={event=>setAutomatic(event.target.checked)}/>
              Автоматические расчёты
            </label>
            <label className="pf-settings-option">
              <input type="checkbox" checked={navigationHelp} onChange={event=>setNavigationHelp(event.target.checked)}/>
              Помощь в навигации
            </label>
            <button type="button" className="pf-settings-pages-button"
              onClick={()=>{setSettingsOpen(false);setPageSettingsOpen(true);}}>
              <Files size={16}/> Страницы листа…
            </button>
          </div>}
        </div>

      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {pdfError && <p role="alert" className="form-error">{pdfError}</p>}
    <div className="pf-sheet-scroll" aria-label="Страницы листа Pathfinder 2e">
      <div className={`pf-sheet-stack${monochrome?' pf-monochrome':''}`}>
        {visiblePages.map(page=>page==='notes'
          ? <OptionalNotesPage key="notes" values={values} disabled={editLocked}
              onChange={(id,value)=>change(id,value)}/>
          : renderPage(Number(page)))}
      </div>
    </div>
    {pageSettingsOpen&&<PageSettingsDialog
      order={pageOrder} notesEnabled={notesEnabled} disabled={editLocked}
      onNotesEnabled={setNotesPageEnabled}
      onOrderChange={setPageOrder}
      onClose={()=>setPageSettingsOpen(false)}/>}
    {spellSettingsOpen&&<SpellcastingDialog values={values} disabled={editLocked}
      onChange={(id,value)=>change(id,value)}
      onRankChange={changeSpellRank}
      onClose={()=>setSpellSettingsOpen(false)}
      onOpenGrimoire={()=>{setSpellSettingsOpen(false);setGrimoireOpen(true);}}/>}
    {grimoireOpen&&<SpellGrimoire selection={savedSpells} traditions={availableTraditions} classes={availableClasses}
      slotCounts={Array.from({length:10},(_,i)=>Math.max(0,Number(values['spell_slots_'+(i+1)]||0)||0))}
      onSelection={entries=>change(PF_SPELL_SELECTION,JSON.stringify(entries))}
      onClose={()=>setGrimoireOpen(false)}/>}
    {navigationHelp&&<nav className="pf-navigation-help" aria-label="Быстрая навигация по листу">
      <div className="pf-navigation-help-title">
        <span>Страницы</span>
        <button type="button" onClick={()=>setNavigationHelp(false)} aria-label="Скрыть помощь в навигации">
          <X size={14}/>
        </button>
      </div>
      {visiblePages.map((page,index)=><button key={page} type="button"
        className={`pf-navigation-help-link${activePage===page?' pf-navigation-help-active':''}`}
        onClick={()=>navigatePage(page)}
        aria-label={`Страница ${index+1}: ${PAGE_LABELS[page]}`}
        aria-current={activePage===page?'page':undefined}
        title={PAGE_LABELS[page]}>
        <span className="pf-navigation-help-number">{index+1}</span>
        <span className="pf-navigation-help-label">{PAGE_LABELS[page]}</span>
      </button>)}
    </nav>}
  </main>;
}

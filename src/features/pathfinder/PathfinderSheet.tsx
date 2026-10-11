import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Cloud, Settings2, X } from 'lucide-react';
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
import { sanitizeSignedNumericInput } from './numeric-input';
import DynamicAdvancement from './DynamicAdvancement';
import { isAdvancementField, advancementLevelCount, addAdvancementLevel, removeAdvancementLevel } from './advancement-model';
import { calculateCore, isAutomatic, isCoreComputedField, RANK_FIELDS, readRank } from './rules-core';
import {calculateSpellcasting,isSpellcastingConfigured,isSpellcastingComputedField,setSpellcastingProficiency} from './rules-spellcasting';
import SpellcastingDialog from './SpellcastingDialog';
import { calculateNativeCombat, isNativeCombatComputedField, isNativeWeaponAttackField, isClassDcConfigured } from './rules-combat';
import { formulaDisplayValue } from './formula-display';
import type { EditableField } from './editor-schema';
import { fieldBox, PDF_HEIGHT, PDF_WIDTH } from './layout';
import PortraitImage from '../portrait/PortraitImage';
import type { CropFrame } from '../portrait/crop';
import './PathfinderSheet.css';

const PAGE_TITLES = ['Характеристики', 'Способности и снаряжение', 'Заметки и действия', 'Заклинания'];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось сохранить лист. Проверь соединение и повтори попытку.';
}

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
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
  portraitUrl?: string;
  portraitFrame?: CropFrame;
  onEditPortrait: () => void;
}) {
  const [values, setValues] = useState<SheetValues>(() => initialSheetValues(character.details, character.name));
  const [templateFields,setTemplateFields] = useState<EditableField[]>(()=>cloneFields(DEFAULT_FIELDS));
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
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSheetValues(character.details, character.name)));
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [spellSettingsOpen,setSpellSettingsOpen] = useState(false);
  const [navigationHelp,setNavigationHelp] = useState<boolean>(()=>{
    try{return window.localStorage.getItem('ays-pf2e-navigation-help')==='1';}
    catch{return false;}
  });
  const [activePage,setActivePage] = useState(1);
  useEffect(()=>{
    try{window.localStorage.setItem('ays-pf2e-navigation-help',navigationHelp?'1':'0');}
    catch{ /* Keep page navigation available during this session. */ }
  },[navigationHelp]);
  useEffect(()=>{
    if(!navigationHelp)return;
    let frame=0;
    const update=()=>{
      frame=0;
      const sections=PAGE_TITLES.map((_,i)=>document.getElementById('pf-sheet-page-'+(i+1)));
      let active=1;
      for(let i=0;i<sections.length;i++){
        const rect=sections[i]?.getBoundingClientRect();
        if(rect&&rect.top<=window.innerHeight*.33)active=i+1;
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
  },[navigationHelp]);
  function navigatePage(page:number){
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(values) !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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

  async function save(): Promise<boolean> {
    if (saving) return false;
    const cleanName = normalizedName(String(values.name ?? ''));
    if (!cleanName) {
      setError('Укажи имя персонажа на первой странице.');
      document.getElementById('pf-name')?.focus();
      return false;
    }
    setSaving(true);
    setError('');
    const snapshot = JSON.stringify(values);
    // Persist the evaluated values too: exported JSON and manual-mode fallback
    // remain meaningful outside the live rule engine. Source fields are never overwritten.
    const toStore = { ...values };
    for (const key of Object.keys(toStore)) {
      if ((key === 'armor_class' || (key === 'class_dc' && isClassDcConfigured(values)) || (spellcastingConfigured && isSpellcastingComputedField(key)) || (automatic && key !== 'class_dc' && (isCoreComputedField(key) || (isNativeCombatComputedField(key) && !isNativeWeaponAttackField(key)))))
        && !(key in computed)) toStore[key] = '';
    }
    Object.assign(toStore, computed);
    const details = persistSheetValues(character.details, toStore, cleanName);
    try {
      const success = await onSave(character.id, cleanName, details);
      if (!success) {
        setError('Не удалось сохранить лист в Supabase. Повтори попытку.');
        return false;
      }
      setSavedSnapshot(snapshot);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goBack() {
    if (saving) return;
    if (dirty && !(await save())) return;
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
        disabled={saving} onChange={next=>change('dying',next)}/>;
    }
    if (RANK_FIELDS.has(field.id)) {
      return <RankSelect key={field.id} id={id} label={field.label}
        rank={readRank(values[field.id]) ?? 0} style={style}
        disabled={saving} onChange={rank => change(field.id, String(rank))}/>;
    }
    const computedField = field.id === 'armor_class' || field.id === 'class_dc' || isNativeWeaponAttackField(field.id) || (spellcastingConfigured && isSpellcastingComputedField(field.id)) || (automatic && (isCoreComputedField(field.id) || isNativeCombatComputedField(field.id)));
    if (field.kind === 'toggle') {
      return <label key={field.id} className="pf-field pf-field-toggle" style={style}>
        <input id={id} type="checkbox" checked={value === true}
          onChange={event => change(field.id, event.target.checked)}
          aria-label={field.label} disabled={saving} />
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
      disabled: saving,
    };
    if (field.kind === 'select') {
      const options = field.options ?? [];
      const current = String(value ?? '');
      const legacy = Boolean(current) && !options.includes(current);
      return <select key={field.id} id={id} aria-label={field.label}
        className={`pf-field pf-field-text pf-field-select${field.underline ? " pf-field-underline" : ""}`} style={style} value={current}
        disabled={saving} onChange={event => change(field.id,event.target.value)}>
        <option value="">—</option>
        {legacy && <option value={current}>{current}</option>}
        {options.map(option=><option key={option} value={option}>{option}</option>)}
      </select>;
    }
    const narrow = field.w < 40 ? ' pf-field-narrow' : '';
    const tiny = field.w < 20 ? ' pf-field-tiny' : '';
    if (field.kind === 'long') {
      return <RichField key={field.id} id={id} label={field.label}
        className={`pf-field pf-field-text pf-field-long${narrow}${tiny}${field.underline ? " pf-field-underline" : ""}`}
        style={style} value={String(value??'')} resourceContext={values} disabled={saving||computedField}
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
      {page===4&&<button type="button" className="pf-spell-settings-trigger"
        disabled={saving} onClick={()=>setSpellSettingsOpen(true)}
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
        count={advancementLevelCount(values)} disabled={saving}
        pageArtUrl={`${import.meta.env.BASE_URL}pathfinder/page-2.webp?v=3`}
        onValueChange={(id,value)=>change(id,value)}
        onAdd={()=>setValues(old=>addAdvancementLevel(old))}
        onRemove={level=>setValues(old=>removeAdvancementLevel(old,level))}/>}
    </section>;
  }

  return <main className="page pf-editor">
    <div className="pf-toolbar">
      <button type="button" className="text-button" onClick={() => void goBack()} disabled={saving}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <div className="pf-toolbar-heading">
        <h1 className="pf-minimal-title">Лист персонажа PF2e</h1>
      </div>
      <div className="pf-toolbar-right">
        <span className={`pf-save-status ${dirty ? 'pf-unsaved' : ''}`} aria-live="polite">
          {saving ? 'Сохранение…' : dirty ? 'Есть изменения' : 'Сохранено'}
        </span>
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
          </div>}
        </div>
        <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
          <Cloud size={16} /> Сохранить
        </button>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="pf-sheet-scroll" aria-label="Четыре страницы листа Pathfinder 2e">
      <div className={`pf-sheet-stack${monochrome?' pf-monochrome':''}`}>
        {PAGE_TITLES.map((_, index) => renderPage(index + 1))}
      </div>
    </div>
    {spellSettingsOpen&&<SpellcastingDialog values={values} disabled={saving}
      onChange={(id,value)=>change(id,value)}
      onRankChange={changeSpellRank}
      onClose={()=>setSpellSettingsOpen(false)}/>}
    {navigationHelp&&<nav className="pf-navigation-help" aria-label="Быстрая навигация по листу">
      <div className="pf-navigation-help-title">
        <span>Страницы</span>
        <button type="button" onClick={()=>setNavigationHelp(false)} aria-label="Скрыть помощь в навигации">
          <X size={14}/>
        </button>
      </div>
      {PAGE_TITLES.map((title,index)=><button key={title} type="button"
        className={`pf-navigation-help-link${activePage===index+1?' pf-navigation-help-active':''}`}
        onClick={()=>navigatePage(index+1)}
        aria-label={`Страница ${index+1}: ${title}`}
        aria-current={activePage===index+1?'page':undefined}
        title={title}>
        <span className="pf-navigation-help-number">{index+1}</span>
        <span className="pf-navigation-help-label">{title}</span>
      </button>)}
    </nav>}
  </main>;
}

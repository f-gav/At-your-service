import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Cloud, Settings2 } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import { initialSheetValues, persistSheetValues } from './sheet-values';
import type { FieldValue, SheetValues } from './sheet-values';
import { supabase } from '../../lib/supabase';
import { DEFAULT_FIELDS, cloneFields, validFields, withEquipmentNumberFields } from './editor-schema';
import ToggleVisual from './ToggleVisual';
import RankSelect from './RankSelect';
import { calculateCore, isAutomatic, isCoreComputedField, RANK_FIELDS, readRank } from './rules-core';
import { calculateNativeCombat, isNativeCombatComputedField } from './rules-combat';
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
      if(active && !error && validFields(data?.fields)) setTemplateFields(withEquipmentNumberFields(cloneFields(data.fields)));
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
  // AC is always the sum of the three editable PDF-strip cells, independent of
  // the optional auto-rules mode for skills, saves and other derived values.
  const computed = useMemo(() => {
    const combat = calculateNativeCombat(values);
    return automatic ? { ...calculateCore({ ...values, ...combat }), ...combat }
      : (combat.armor_class === undefined ? {} : { armor_class: combat.armor_class });
  }, [automatic, values]);
  const displayValues = useMemo(() => ({ ...values, ...computed }), [values, computed]);
  function setAutomatic(enabled: boolean) {
    if (enabled && !window.confirm('Включить автоматические расчёты PF2e? Они изменят итоги навыков, спасбросков, Восприятия и порог поломки щита. КД всегда считается по плашке: 10 + Ловкость + Умение + Предмет. Ручные итоги заменятся формулами, а исходные значения сохранятся.')) return;
    setValues(prev => ({ ...prev, rulesMode: enabled ? 'auto' : 'manual' }));
  }
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSheetValues(character.details, character.name)));
  const [settingsOpen,setSettingsOpen] = useState(false);
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
    setValues(previous => previous[id] === value ? previous : { ...previous, [id]: value });
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
      if ((key === 'armor_class' || (automatic && (isCoreComputedField(key) || isNativeCombatComputedField(key))))
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
    const value = (field.id === 'armor_class' || (automatic && (isCoreComputedField(field.id) || isNativeCombatComputedField(field.id)))) && !(field.id in computed)
      ? '' : displayValues[field.id];
    if (RANK_FIELDS.has(field.id)) {
      return <RankSelect key={field.id} id={id} label={field.label}
        rank={readRank(values[field.id]) ?? 0} style={style}
        disabled={saving} onChange={rank => change(field.id, String(rank))}/>;
    }
    const computedField = field.id === 'armor_class' || (automatic && (isCoreComputedField(field.id) || isNativeCombatComputedField(field.id)));
    if (field.kind === 'toggle') {
      return <label key={field.id} className="pf-field pf-field-toggle" style={style} title={field.label}>
        <input id={id} type="checkbox" checked={value === true}
          onChange={event => change(field.id, event.target.checked)}
          aria-label={field.label} disabled={saving} />
        <ToggleVisual field={field} checked={value === true}/>
      </label>;
    }
    const shared = {
      id,
      'aria-label': field.label,
      title: field.label,
      value: String(value ?? ''),
      maxLength: field.maxlen,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!computedField) change(field.id, event.target.value);
      },
      readOnly: computedField,
      disabled: saving,
    };
    if (field.kind === 'select') {
      const options = field.options ?? [];
      const current = String(value ?? '');
      const legacy = Boolean(current) && !options.includes(current);
      return <select key={field.id} id={id} aria-label={field.label} title={field.label}
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
      return <textarea key={field.id} className={`pf-field pf-field-text pf-field-long${narrow}${tiny}${field.underline ? " pf-field-underline" : ""}`} style={style} {...shared} spellCheck={false} />;
    }
    const numeric = field.kind === 'number' || field.kind === 'counter';
    return <input
      key={field.id}
      className={`pf-field pf-field-text${numeric ? ' pf-field-number' : ''}${narrow}${tiny}${field.id === 'name' ? ' pf-field-character-name' : ''}${field.underline ? ' pf-field-underline' : ''}`}
      style={style}
      {...shared}
      type="text"
      inputMode={numeric && !computedField && !/^weapon_[1-5]_damage$/.test(field.id) ? 'numeric' : 'text'}
      aria-description={computedField ? 'Автоматический расчёт — исходные параметры изменяются непосредственно в соседних полях листа' : undefined}
    />;
  }

  function renderPage(page: number) {
    const pageFields = templateFields.filter(field => field.page===page);

    return <section key={page} className="pf-sheet-page" aria-label={`Страница ${page}: ${PAGE_TITLES[page - 1]}`}>
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
        title="Нажми, чтобы добавить или сменить портрет" aria-label="Загрузить или сменить портрет персонажа"
        onClick={onEditPortrait}>
          <PortraitImage url={portraitUrl || `${import.meta.env.BASE_URL}pathfinder/portrait-placeholder.webp`}
            frame={portraitUrl?portraitFrame:undefined} />
        </button>}
      {pageFields.map(renderField)}
    </section>;
  }

  return <main className="page pf-editor">
    <div className="pf-toolbar">
      <button type="button" className="text-button" onClick={() => void goBack()} disabled={saving}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <div className="pf-toolbar-heading">
        <h1 className="pf-minimal-title">Лист персонажа PF2e</h1>
        <span className="pf-rules-label" title="Режим можно изменить в настройках листа">
          {automatic ? 'Расчёты: авто' : 'Расчёты: вручную'}
        </span>
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
            <p className="pf-settings-note">КД всегда равен 10 + Ловкость + Умение + Предмет по ручным значениям в плашке. Число на щите заполняется отдельно. При включении автоматики также рассчитываются навыки, спасброски, Восприятие и порог поломки. Положение и оформление полей можно изменить в редакторе.</p>
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
  </main>;
}

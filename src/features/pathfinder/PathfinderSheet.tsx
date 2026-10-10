import { useEffect, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Check, Cloud, Minus, Plus, Settings2 } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import { initialSheetValues, persistSheetValues } from './sheet-values';
import type { FieldValue, SheetValues } from './sheet-values';
import { supabase } from '../../lib/supabase';
import { DEFAULT_FIELDS, cloneFields, validFields } from './editor-schema';
import { isHeroPointId } from './field-options';
import type { EditableField } from './editor-schema';
import { fieldBox, PDF_HEIGHT, PDF_WIDTH } from './layout';
import type { PathfinderField } from './layout';
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
  onEditPortrait,
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
  portraitUrl?: string;
  onEditPortrait: () => void;
}) {
  const [values, setValues] = useState<SheetValues>(() => initialSheetValues(character.details, character.name));
  const [templateFields,setTemplateFields] = useState<EditableField[]>(()=>cloneFields(DEFAULT_FIELDS));
  useEffect(() => {
    if(!supabase)return;
    let active=true;
    void supabase.from('sheet_templates').select('fields').eq('template_key','pf2e').maybeSingle().then(({data,error})=>{
      if(active && !error && validFields(data?.fields)) setTemplateFields(cloneFields(data.fields));
    });
    return()=>{active=false;};
  },[]);
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
  const [focusedCounter, setFocusedCounter] = useState<string | null>(null);
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

  function step(field: PathfinderField, delta: number) {
    const oldValue = Number(values[field.id]);
    const current = Number.isFinite(oldValue) ? oldValue : 0;
    const minimum = field.min ?? -999999;
    const maximum = field.max ?? 999999;
    change(field.id, String(Math.max(minimum, Math.min(maximum, current + delta))));
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
    const details = persistSheetValues(character.details, values, cleanName);
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
      textAlign: field.textAlign || undefined,
      color: field.color || undefined,
      padding: field.paddingX !== undefined || field.paddingY !== undefined ? ((100*(field.paddingY??0)/PDF_WIDTH)+'cqw '+(100*(field.paddingX??2)/PDF_WIDTH)+'cqw') : undefined,
    };
    const id = `pf-${field.id}`;
    const value = values[field.id];
    if (field.kind === 'toggle') {
      const heroPoint = isHeroPointId(field.id);
      return <label key={field.id} className={`pf-field pf-field-toggle${heroPoint?' pf-field-hero-toggle':''}`} style={style} title={field.label}>
        <input id={id} type="checkbox" checked={value === true} onChange={event => change(field.id, event.target.checked)} aria-label={field.label} disabled={saving} />
        <span aria-hidden="true">{!heroPoint && <Check />}</span>
      </label>;
    }
    const shared = {
      id,
      'aria-label': field.label,
      title: field.label,
      value: String(value ?? ''),
      maxLength: field.maxlen,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(field.id, event.target.value),
      disabled: saving,
    };
    if (field.kind === 'select') {
      const options = field.options ?? [];
      const current = String(value ?? '');
      const legacy = Boolean(current) && !options.includes(current);
      return <select key={field.id} id={id} aria-label={field.label} title={field.label}
        className="pf-field pf-field-text pf-field-select" style={style} value={current}
        disabled={saving} onChange={event => change(field.id,event.target.value)}>
        <option value="">—</option>
        {legacy && <option value={current}>{current}</option>}
        {options.map(option=><option key={option} value={option}>{option}</option>)}
      </select>;
    }
    const narrow = field.w < 40 ? ' pf-field-narrow' : '';
    const tiny = field.w < 20 ? ' pf-field-tiny' : '';
    if (field.kind === 'long') {
      return <textarea key={field.id} className={`pf-field pf-field-text pf-field-long${narrow}${tiny}`} style={style} {...shared} spellCheck={false} />;
    }
    const numeric = field.kind === 'number' || field.kind === 'counter';
    return <input
      key={field.id}
      className={`pf-field pf-field-text${numeric ? ' pf-field-number' : ''}${narrow}${tiny}${field.id === 'name' ? ' pf-field-character-name' : ''}`}
      style={style}
      {...shared}
      type="text"
      inputMode={numeric ? 'numeric' : 'text'}
      onFocus={field.kind === 'counter' ? () => setFocusedCounter(field.id) : undefined}
      onBlur={field.kind === 'counter' ? () => setFocusedCounter(null) : undefined}
      onKeyDown={field.kind === 'counter' ? event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          step(field, event.key === 'ArrowUp' ? 1 : -1);
        }
      } : undefined}
    />;
  }

  function renderPage(page: number) {
    const pageFields = templateFields.filter(field => field.page===page);
    const counter = pageFields.find(field => field.id === focusedCounter && field.kind === 'counter');
    const counterBox = counter ? fieldBox(counter) : null;
    const counterStyle: CSSProperties | undefined = counter && counterBox ? {
      left: `${100 * (counterBox.x + counterBox.w / 2) / PDF_WIDTH}%`,
      top: `${100 * (counterBox.y + counterBox.h) / PDF_HEIGHT}%`,
    } : undefined;

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
          <img src={portraitUrl || `${import.meta.env.BASE_URL}pathfinder/portrait-placeholder.webp`}
            alt="" draggable={false} />
        </button>}
      {pageFields.map(renderField)}
      {counter && <div className="pf-counter-popup" style={counterStyle} role="group" aria-label={`Изменить: ${counter.label}`} onMouseDown={event => event.preventDefault()}>
        <button type="button" aria-label={`Уменьшить: ${counter.label}`} onClick={() => step(counter, -1)}><Minus size={16} /></button>
        <span>{String(values[counter.id] || '0')}</span>
        <button type="button" aria-label={`Увеличить: ${counter.label}`} onClick={() => step(counter, 1)}><Plus size={16} /></button>
      </div>}
    </section>;
  }

  return <main className="page pf-editor">
    <div className="pf-toolbar">
      <button type="button" className="text-button" onClick={() => void goBack()} disabled={saving}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <h1 className="pf-minimal-title">Лист персонажа PF2e</h1>
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

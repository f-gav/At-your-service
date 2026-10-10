import { useEffect, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Check, Cloud, Minus, Plus } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import rawFields from './fields.json';
import { fieldBox, PDF_HEIGHT, PDF_WIDTH } from './layout';
import type { PathfinderField } from './layout';
import './PathfinderSheet.css';

type FieldValue = string | boolean;
type SheetValues = Record<string, FieldValue>;

const FIELDS: PathfinderField[] = rawFields as PathfinderField[];
const PAGE_TITLES = ['Характеристики', 'Способности и снаряжение', 'Заметки и действия', 'Заклинания'];
const SHEET_KEY = 'pathfinderSheet';

// Prepared once, not on every keystroke. Each page has its own overlays.
const FIELDS_BY_PAGE = PAGE_TITLES.map((_, i) => FIELDS.filter(field => field.page === i + 1));

function initialValues(character: Character): SheetValues {
  const saved = character.details[SHEET_KEY];
  const stored = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved as Record<string, unknown> : {};
  const result: SheetValues = {};
  for (const field of FIELDS) {
    const value = stored[field.id];
    if (field.kind === 'toggle') result[field.id] = value === true;
    else result[field.id] = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  }
  result.name = character.name;
  return result;
}

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
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<SheetValues>(() => initialValues(character));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialValues(character)));
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
    const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== false));
    const details: CharacterDetails = {
      ...character.details,
      [SHEET_KEY]: { ...filled, name: cleanName, schemaVersion: 1 },
    };
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

  function renderField(field: PathfinderField) {
    const box = fieldBox(field);
    const style: CSSProperties = {
      left: `${100 * box.x / PDF_WIDTH}%`,
      top: `${100 * box.y / PDF_HEIGHT}%`,
      width: `${100 * box.w / PDF_WIDTH}%`,
      height: `${100 * box.h / PDF_HEIGHT}%`,
    };
    const id = `pf-${field.id}`;
    const value = values[field.id];
    if (field.kind === 'toggle') {
      return <label key={field.id} className="pf-field pf-field-toggle" style={style} title={field.label}>
        <input id={id} type="checkbox" checked={value === true} onChange={event => change(field.id, event.target.checked)} aria-label={field.label} disabled={saving} />
        <span aria-hidden="true"><Check /></span>
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
    const pageFields = FIELDS_BY_PAGE[page - 1];
    const counter = pageFields.find(field => field.id === focusedCounter && field.kind === 'counter');
    const counterBox = counter ? fieldBox(counter) : null;
    const counterStyle: CSSProperties | undefined = counter && counterBox ? {
      left: `${100 * (counterBox.x + counterBox.w / 2) / PDF_WIDTH}%`,
      top: `${100 * (counterBox.y + counterBox.h) / PDF_HEIGHT}%`,
    } : undefined;

    return <section key={page} className="pf-sheet-page" aria-label={`Страница ${page}: ${PAGE_TITLES[page - 1]}`}>
      <img
        src={`${import.meta.env.BASE_URL}pathfinder/page-${page}.webp?v=2`}
        width="2404"
        height="3130"
        loading={page === 1 ? 'eager' : 'lazy'}
        decoding="async"
        alt={`Бланк Pathfinder 2e, страница ${page}: ${PAGE_TITLES[page - 1]}`}
        draggable={false}
      />
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
        <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
          <Cloud size={16} /> Сохранить
        </button>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="pf-sheet-scroll" aria-label="Четыре страницы листа Pathfinder 2e">
      <div className="pf-sheet-stack">
        {PAGE_TITLES.map((_, index) => renderPage(index + 1))}
      </div>
    </div>
  </main>;
}

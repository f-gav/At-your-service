import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowLeft, Check, Cloud, Download, Minus, Plus, ShieldCheck, ZoomIn, ZoomOut } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import rawFields from './fields.json';
import './PathfinderSheet.css';

type FieldKind = 'text' | 'long' | 'number' | 'counter' | 'toggle';
type Field = {
  id: string;
  label: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FieldKind;
  maxlen?: number;
  min?: number;
  max?: number;
};
type FieldValue = string | boolean;
type SheetValues = Record<string, FieldValue>;

const FIELDS: Field[] = rawFields as Field[];
const PDF_WIDTH = 600.945;
const PDF_HEIGHT = 782.362;
const PAGE_TITLES = ['Характеристики', 'Способности и снаряжение', 'Заметки и действия', 'Заклинания'];
const SHEET_KEY = 'pathfinderSheet';

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
 * Visual overlays are defined in fields.json using PDF-point coordinates.
 * The original sheet is a separate, immutable image asset; gameplay rules,
 * field state and persistence do not depend on the rendered layout.
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
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [focusedCounter, setFocusedCounter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(values) !== savedSnapshot;
  const visibleFields = useMemo(() => FIELDS.filter(field => field.page === page), [page]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(id: string, value: FieldValue) {
    setValues(previous => previous[id] === value ? previous : { ...previous, [id]: value });
  }

  function step(field: Field, delta: number) {
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
      setPage(1);
      return false;
    }
    setSaving(true);
    setError('');
    const snapshot = JSON.stringify(values);
    // A version marker lets later rule engines migrate old sheets safely.
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== '' && value !== false),
    );
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

  function renderField(field: Field) {
    const style: CSSProperties = {
      left: `${100 * field.x / PDF_WIDTH}%`,
      top: `${100 * field.y / PDF_HEIGHT}%`,
      width: `${100 * field.w / PDF_WIDTH}%`,
      height: `${100 * field.h / PDF_HEIGHT}%`,
    };
    const id = `pf-${field.id}`;
    const value = values[field.id];
    if (field.kind === 'toggle') {
      return <label key={field.id} className="pf-field pf-field-toggle" style={style} title={field.label}>
        <input id={id} type="checkbox" checked={value === true} onChange={event => change(field.id, event.target.checked)} aria-label={field.label} />
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
    if (field.kind === 'long') {
      return <textarea key={field.id} className="pf-field pf-field-text pf-field-long" style={style} {...shared} spellCheck={false} />;
    }
    return <input
      key={field.id}
      className={`pf-field pf-field-text ${field.kind === 'number' || field.kind === 'counter' ? 'pf-field-number' : ''}`}
      style={style}
      {...shared}
      type="text"
      inputMode={field.kind === 'number' || field.kind === 'counter' ? 'numeric' : 'text'}
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

  const counter = visibleFields.find(field => field.id === focusedCounter && field.kind === 'counter');
  const counterStyle: CSSProperties | undefined = counter ? {
    left: `${100 * (counter.x + counter.w / 2) / PDF_WIDTH}%`,
    top: `${100 * (counter.y + counter.h) / PDF_HEIGHT}%`,
  } : undefined;

  return <main className="page pf-editor">
    <div className="pf-toolbar">
      <button type="button" className="text-button" onClick={() => void goBack()} disabled={saving}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <div className="pf-toolbar-right">
        <span className={`pf-save-status ${dirty ? 'pf-unsaved' : ''}`} aria-live="polite">
          {saving ? 'Сохранение…' : dirty ? 'Есть изменения' : 'Сохранено'}
        </span>
        <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
          <Cloud size={16} /> Сохранить
        </button>
      </div>
    </div>
    <div className="pf-title-row">
      <div>
        <span className="pf-eyebrow">PATHFINDER · 2E REMASTER</span>
        <h1>Лист персонажа</h1>
        <p>Редактируемый оригинальный бланк. Поля сохраняются в твоём аккаунте.</p>
      </div>
      <a className="pf-download" href={`${import.meta.env.BASE_URL}pathfinder/Pathfinder_2e_RU_editable_V1.pdf`} download>
        <Download size={16} /> PDF с полями
      </a>
    </div>
    <div className="pf-sheet-tools">
      <nav className="pf-page-tabs" aria-label="Страницы листа">
        {PAGE_TITLES.map((title, i) => <button type="button" key={title} aria-current={page === i + 1 ? 'page' : undefined}
          className={page === i + 1 ? 'is-active' : ''} onClick={() => { setPage(i + 1); setFocusedCounter(null); }}>
          <span>{i + 1}</span> {title}
        </button>)}
      </nav>
      <div className="pf-zoom" aria-label="Масштаб страницы">
        <button type="button" onClick={() => setZoom(z => Math.max(70, z - 10))} disabled={zoom <= 70} aria-label="Уменьшить масштаб"><ZoomOut size={16} /></button>
        <span>{zoom}%</span>
        <button type="button" onClick={() => setZoom(z => Math.min(150, z + 10))} disabled={zoom >= 150} aria-label="Увеличить масштаб"><ZoomIn size={16} /></button>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="pf-sheet-scroll" aria-label={`Страница ${page}: ${PAGE_TITLES[page - 1]}`}>
      <div className="pf-sheet-page" style={{ width: `${Math.round(960 * zoom / 100)}px` }}>
        <img src={`${import.meta.env.BASE_URL}pathfinder/page-${page}.webp`} alt={`Исходный бланк Pathfinder, страница ${page}: ${PAGE_TITLES[page - 1]}`} draggable={false} />
        {visibleFields.map(renderField)}
        {counter && <div className="pf-counter-popup" style={counterStyle} role="group" aria-label={`Изменить: ${counter.label}`} onMouseDown={event => event.preventDefault()}>
          <button type="button" aria-label={`Уменьшить: ${counter.label}`} onClick={() => step(counter, -1)}><Minus size={16} /></button>
          <span>{String(values[counter.id] || '0')}</span>
          <button type="button" aria-label={`Увеличить: ${counter.label}`} onClick={() => step(counter, 1)}><Plus size={16} /></button>
        </div>}
      </div>
    </div>
    <div className="pf-sheet-footer">
      <span><ShieldCheck size={16} /> Пока без автоматических расчётов: все значения вводятся вручную.</span>
      <span>Страница {page} из 4 · {visibleFields.length} интерактивных полей</span>
    </div>
  </main>;
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Cloud, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import PortraitImage from '../portrait/PortraitImage';
import RichField from '../pathfinder/RichField';
import type { CropFrame } from '../portrait/crop';
import {
  MOON_PAGES, MOON_ATTRIBUTES, readMoonSheet, saveMoonSheet,
  moonCalculatedMax, moonDisplayedMax, moonAttackBonus, addMoonSkill,
} from './model';
import type { MoonPage, MoonResourceId, MoonItem, MoonWeapon } from './model';
import './ProjectMoonSheet.css';

const RESOURCES: { id: MoonResourceId; label: string }[] = [
  { id: 'hp', label: 'HP · Здоровье' },
  { id: 'st', label: 'ST · Ошеломление' },
  { id: 'sp', label: 'SP · Рассудок' },
  { id: 'light', label: 'L · Light' },
];

type Props = {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
  portraitUrl?: string;
  portraitFrame?: CropFrame;
  onEditPortrait: () => void;
};

export default function ProjectMoonSheet({ character, onSave, onClose, portraitUrl, portraitFrame, onEditPortrait }: Props) {
  const [name, setName] = useState(character.name);
  const [sheet, setSheet] = useState(() => readMoonSheet(character.details));
  const [page, setPage] = useState<MoonPage>('dossier');
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify([character.name, readMoonSheet(character.details)]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify([name, sheet]) !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (key: string, value: string) =>
    setSheet(old => ({ ...old, fields: { ...old.fields, [key]: value } }));
  const updateSkill = (index: number, patch: Partial<MoonItem>) =>
    setSheet(old => ({ ...old, skills: old.skills.map((entry, i) => i === index ? { ...entry, ...patch } : entry) }));
  const updateNote = (index: number, patch: Partial<MoonItem>) =>
    setSheet(old => ({ ...old, notes: old.notes.map((entry, i) => i === index ? { ...entry, ...patch } : entry) }));
  const updateWeapon = (index: number, patch: Partial<MoonWeapon>) =>
    setSheet(old => ({ ...old, weapons: old.weapons.map((entry, i) => i === index ? { ...entry, ...patch } : entry) }));
  const changeMax = (id: MoonResourceId, value: string) => setSheet(old => {
    if (moonCalculatedMax(old, id) !== null) {
      return { ...old, maxOverrides: { ...old.maxOverrides, [id]: value } };
    }
    return { ...old, fields: { ...old.fields, [id + 'Max']: value } };
  });
  const resetMax = (id: MoonResourceId) => setSheet(old => {
    const maxOverrides = { ...old.maxOverrides };
    delete maxOverrides[id];
    return { ...old, maxOverrides };
  });
  const adjustResource = (id: MoonResourceId, offset: number) => setSheet(old => {
    const key = id + 'Current';
    const current = /^-?\d+$/.test(old.fields[key] ?? '') ? Number(old.fields[key]) : 0;
    return { ...old, fields: { ...old.fields, [key]: String(current + offset) } };
  });

  async function save(): Promise<boolean> {
    if (saving) return false;
    const cleanName = normalizedName(name);
    if (!cleanName) { setError('Укажи имя персонажа.'); return false; }
    setSaving(true); setError('');
    try {
      const success = await onSave(character.id, cleanName, saveMoonSheet(character.details, sheet));
      if (!success) { setError('Не удалось сохранить. Проверь соединение и повтори попытку.'); return false; }
      setName(cleanName);
      setSavedSnapshot(JSON.stringify([cleanName, sheet]));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить лист.');
      return false;
    } finally { setSaving(false); }
  }
  async function back() {
    if (saving) return;
    if (dirty && !(await save())) return;
    onClose();
  }
  function selectPage(next: MoonPage) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const field = (label: string, key: string, placeholder = '', extraClass = '') =>
    <label className={'moon-field ' + extraClass} key={key}>
      <span>{label}</span>
      <input type="text" disabled={saving} value={sheet.fields[key] ?? ''} placeholder={placeholder}
        onChange={event => change(key, event.target.value)} maxLength={220} />
    </label>;
  const longField = (label: string, key: string, placeholder = '') =>
    <section className="moon-text-panel" key={key}>
      <h3>{label}</h3>
      <RichField id={'moon-' + key} label={label} value={sheet.fields[key] ?? ''}
        onChange={value => change(key, value)} placeholder={placeholder} disabled={saving} grow />
    </section>;

  return <main className="page page-editor moon-editor">
    <div className="editor-nav">
      <button type="button" className="text-button" disabled={saving} onClick={() => void back()}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <div className="editor-actions">
        <span className={'save-status' + (dirty ? ' status-changed' : '')} aria-live="polite">
          {saving ? 'Сохранение…' : dirty ? 'Есть изменения' : 'Сохранено в аккаунте'}
        </span>
        <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
          <Cloud size={16} /> Сохранить
        </button>
      </div>
    </div>

    <div className="moon-intro">
      <span>AT YOUR SERVICE / PROJECT MOON</span>
      <h1>Лист персонажа</h1>
      <p>Лист по мотивам согласованного досье · Community Rulebook 3.x</p>
    </div>
    <nav className="moon-tabs" aria-label="Страницы Project Moon">
      {MOON_PAGES.map(({ id, title }, index) =>
        <button key={id} type="button" className={page === id ? 'moon-tab moon-tab-active' : 'moon-tab'}
          aria-current={page === id ? 'page' : undefined} onClick={() => selectPage(id)}>
          <span>0{index + 1}</span> {title}
        </button>)}
    </nav>

    <article className="moon-paper" aria-label={'Страница: ' + MOON_PAGES.find(p => p.id === page)?.title}>
      <header className="moon-page-heading">
        <span>PROJECT MOON / CHARACTER RECORD</span>
        <h2>{MOON_PAGES.find(item => item.id === page)?.title}</h2>
      </header>

      {page === 'dossier' && <>
        <div className="moon-dossier-top">
          <div className="moon-dossier-fields">
            <label className="moon-field moon-name"><span>ИМЯ ПЕРСОНАЖА</span>
              <input type="text" disabled={saving} maxLength={100} value={name} onChange={event => setName(event.target.value)}
                placeholder="Имя персонажа" />
            </label>
            <div className="moon-fields-grid">
              {field('Занятие', 'occupation')}
              {field('Организация', 'organization')}
              {field('Ранг', 'rank', 'Введите ранг')}
              {field('Уровень', 'level')}
              {field('EXP', 'exp')}
              {field('Деньги', 'money')}
            </div>
          </div>
          <button type="button" className="moon-portrait-button" onClick={onEditPortrait} aria-label="Изменить портрет">
            <span className="moon-portrait-window">
              {portraitUrl ? <PortraitImage url={portraitUrl} frame={portraitFrame} /> :
                <span className="moon-portrait-empty">ПОРТРЕТ<br />Нажмите, чтобы добавить</span>}
            </span>
            <span className="moon-portrait-caption">ИЗМЕНИТЬ ПОРТРЕТ</span>
          </button>
        </div>
        <section className="moon-section">
          <h3>Основные характеристики</h3>
          <div className="moon-attributes">
            {MOON_ATTRIBUTES.map(item =>
              <label className="moon-attribute" key={item.id}>
                <span>{item.label}</span>
                <input inputMode="numeric" type="text" maxLength={4} disabled={saving}
                  value={sheet.fields[item.id] ?? ''} onChange={event => change(item.id, event.target.value)}
                  placeholder="—" aria-label={item.label} />
              </label>)}
          </div>
        </section>
        <section className="moon-section">
          <h3>Инвентарь</h3>
          {longField('Вещи и снаряжение', 'inventory', 'Предметы, деньги, снаряжение…')}
        </section>
      </>}

      {page === 'combat' && <>
        <section className="moon-section">
          <div className="moon-section-head">
            <h3>Ресурсы</h3>
            <label className="moon-auto-setting">
              <input type="checkbox" disabled={saving} checked={sheet.autoVitals}
                onChange={event => setSheet(old => ({ ...old, autoVitals: event.target.checked }))} />
              <Settings2 size={15} /> Автоматический подсчёт HP / ST / SP
            </label>
          </div>
          <div className="moon-resources">
            {RESOURCES.map(({ id, label }) => {
              const computed = moonCalculatedMax(sheet, id);
              const overridden = Object.prototype.hasOwnProperty.call(sheet.maxOverrides, id);
              return <div className="moon-resource" key={id}>
                <strong>{label}</strong>
                <div className="moon-resource-controls">
                  <button type="button" disabled={saving} onClick={() => adjustResource(id, -1)}
                    title="Уменьшить текущее значение" aria-label={'Уменьшить ' + id}>−</button>
                  <input type="text" inputMode="numeric" maxLength={8} disabled={saving}
                    aria-label={'Текущее ' + id} value={sheet.fields[id + 'Current'] ?? ''}
                    placeholder="Тек." onChange={event => change(id + 'Current', event.target.value)} />
                  <button type="button" disabled={saving} onClick={() => adjustResource(id, 1)}
                    title="Увеличить текущее значение" aria-label={'Увеличить ' + id}>+</button>
                  <span>/</span>
                  <input type="text" inputMode="numeric" maxLength={8} disabled={saving}
                    aria-label={'Максимальное ' + id} placeholder="Макс."
                    value={moonDisplayedMax(sheet, id)} onChange={event => changeMax(id, event.target.value)} />
                  {computed !== null && overridden && <button type="button" disabled={saving}
                    title="Вернуть автоматический расчёт" aria-label={'Сбросить ручной максимум ' + id}
                    onClick={() => resetMax(id)}><RotateCcw size={13} /></button>}
                </div>
              </div>;
            })}
          </div>
        </section>
        <section className="moon-section">
          <h3>Боевые показатели</h3>
          <div className="moon-fields-grid moon-combat-fields">
            <label className="moon-field"><span>Бонус атаки · от ранга</span>
              <input readOnly type="text" value={moonAttackBonus(sheet)} placeholder="—" aria-label="Бонус атаки" />
            </label>
            {field('Модификатор блока', 'blockBonus')}
            {field('Модификатор уклонения', 'evadeBonus')}
            {field('Скорость', 'speed')}
            {field('Перемещение', 'movement')}
            {field('Действия', 'actions')}
            {field('Реакции', 'reactions')}
          </div>
        </section>
        <section className="moon-section">
          <h3>Основное оружие</h3>
          <div className="moon-two-columns">
            {sheet.weapons.map((weapon, index) => <div className="moon-card" key={weapon.id}>
              <div className="moon-card-heading">ОРУЖИЕ {index + 1}</div>
              <label className="moon-field"><span>Название</span>
                <input type="text" maxLength={150} disabled={saving} value={weapon.name}
                  onChange={event => updateWeapon(index, { name: event.target.value })} /></label>
              <div className="moon-fields-grid">
                <label className="moon-field"><span>Кость атаки</span>
                  <input type="text" maxLength={50} disabled={saving} value={weapon.dice}
                    onChange={event => updateWeapon(index, { dice: event.target.value })} placeholder="1d10" /></label>
                <label className="moon-field"><span>Бонус оружия</span>
                  <input type="text" maxLength={50} disabled={saving} value={weapon.bonus}
                    onChange={event => updateWeapon(index, { bonus: event.target.value })} placeholder="+0" /></label>
              </div>
              <div className="moon-rich-group"><span>Свойства и эффекты</span>
                <RichField id={'moon-' + weapon.id} label={'Свойства оружия ' + (index + 1)}
                  value={weapon.description} onChange={value => updateWeapon(index, { description: value })}
                  disabled={saving} grow placeholder="Описание оружия…" />
              </div>
            </div>)}
          </div>
        </section>
        <div className="moon-two-columns">
          <section className="moon-section"><h3>Сопротивления</h3>
            <div className="moon-fields-grid">{field('HP', 'resistanceHp')}{field('ST', 'resistanceSt')}</div>
          </section>
          <section className="moon-section"><h3>Состояния</h3>
            <RichField id="moon-conditions" label="Состояния" value={sheet.fields.conditions ?? ''}
              onChange={value => change('conditions', value)} disabled={saving} grow placeholder="Эффекты, стаки и длительность…" />
          </section>
        </div>
        <section className="moon-section">
          <h3>Боевые приёмы</h3>
          <div className="moon-two-columns">
            {sheet.skills.map((skill, index) => <div className="moon-card" key={skill.id}>
              <div className="moon-card-heading">
                <span>ПРИЁМ {String(index + 1).padStart(2, '0')}</span>
                <button type="button" title="Удалить приём" aria-label={'Удалить приём ' + (index + 1)}
                  disabled={saving} onClick={() => setSheet(old => ({
                    ...old, skills: old.skills.filter(entry => entry.id !== skill.id),
                  }))}><Trash2 size={15} /></button>
              </div>
              <input className="moon-item-title" type="text" maxLength={180} disabled={saving}
                aria-label={'Название приёма ' + (index + 1)} value={skill.title}
                onChange={event => updateSkill(index, { title: event.target.value })} placeholder="Название приёма" />
              <RichField id={'moon-' + skill.id} label={'Приём ' + (index + 1)}
                value={skill.body} onChange={value => updateSkill(index, { body: value })}
                disabled={saving} grow placeholder="Описание, стоимость Light, эффекты…" />
            </div>)}
          </div>
          <button type="button" className="moon-add" disabled={saving || sheet.skills.length >= 100}
            onClick={() => setSheet(old => addMoonSkill(old, 'skill-' + crypto.randomUUID()))}>
            <Plus size={16} /> Добавить приём
          </button>
        </section>
      </>}

      {page === 'about' && <>
        <section className="moon-section">
          <h3>Личные сведения</h3>
          <div className="moon-fields-grid">
            {field('Занятие', 'occupation')}
            {field('Организация', 'organization')}
            {field('Возраст', 'age')}
            {field('Рост', 'height')}
          </div>
        </section>
        <div className="moon-about-panels">
          {longField('Внешность', 'appearance', 'Как выглядит персонаж…')}
          {longField('Характер и убеждения', 'personality', 'Особенности характера…')}
          {longField('Предыстория', 'backstory', 'История персонажа…')}
          {longField('Мотивация', 'motivation', 'Цели и стремления…')}
        </div>
      </>}

      {page === 'notes' && <>
        <div className="moon-two-columns moon-notes">
          {sheet.notes.map((note, index) => <section className="moon-card moon-note" key={note.id}>
            <input type="text" className="moon-item-title" disabled={saving} maxLength={120}
              aria-label={'Заголовок заметки ' + (index + 1)} value={note.title}
              onChange={event => updateNote(index, { title: event.target.value })} placeholder="Заметки" />
            <RichField id={'moon-' + note.id} label={'Заметка ' + (index + 1)}
              value={note.body} onChange={value => updateNote(index, { body: value })}
              disabled={saving} grow placeholder="Текст заметки…" />
          </section>)}
        </div>
      </>}
    </article>
    {error && <p role="alert" className="form-error">{error}</p>}
    <p className="editor-hint">Изменения сохраняются в аккаунте при нажатии «Сохранить» или выходе через «К персонажам».</p>
  </main>;
}

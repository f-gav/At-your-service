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

const RESOURCES: { id: MoonResourceId; short: string; label: string }[] = [
  { id: 'hp', short: 'HP', label: 'Здоровье' },
  { id: 'st', short: 'ST', label: 'Ошеломление' },
  { id: 'sp', short: 'SP', label: 'Рассудок' },
  { id: 'light', short: 'L', label: 'Свет' },
];
const PAGE_ENGLISH: Record<MoonPage, string> = {
  dossier: 'CHARACTER DOSSIER', combat: 'COMBAT DOSSIER',
  about: 'PERSONNEL RECORD', notes: 'NOTES',
};

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
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  useEffect(() => {
    if (!settingsOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [settingsOpen]);

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
  const longField = (label: string, key: string, placeholder = '', extraClass = '') =>
    <section className={'moon-long-field ' + extraClass} key={key}>
      <RichField id={'moon-' + key} label={label} value={sheet.fields[key] ?? ''}
        onChange={value => change(key, value)} placeholder={placeholder} disabled={saving} grow />
    </section>;
  const sectionTitle = (index: number, title: string) =>
    <h3 className="moon-section-title"><span>{String(index).padStart(2, '0')}</span>{title}</h3>;
  const resourceCards = () => <div className="moon-resources">
    {RESOURCES.map(({ id, short, label }) => {
      const computed = moonCalculatedMax(sheet, id);
      const overridden = Object.prototype.hasOwnProperty.call(sheet.maxOverrides, id);
      return <div className="moon-resource" key={id}>
        <strong className="moon-resource-code">{short}</strong>
        <div className="moon-resource-info">
          <span className="moon-resource-title">{label}</span>
          <div className="moon-resource-controls">
            <button type="button" disabled={saving} onClick={() => adjustResource(id, -1)}
              title="Уменьшить текущее значение" aria-label={'Уменьшить ' + id}>−</button>
            <input type="text" inputMode="numeric" maxLength={8} disabled={saving}
              aria-label={'Текущее ' + id} value={sheet.fields[id + 'Current'] ?? ''}
              placeholder="—" onChange={event => change(id + 'Current', event.target.value)} />
            <span>/</span>
            <input type="text" inputMode="numeric" maxLength={8} disabled={saving}
              aria-label={'Максимальное ' + id} placeholder="—"
              value={moonDisplayedMax(sheet, id)} onChange={event => changeMax(id, event.target.value)} />
            <button type="button" disabled={saving} onClick={() => adjustResource(id, 1)}
              title="Увеличить текущее значение" aria-label={'Увеличить ' + id}>+</button>
            {computed !== null && overridden && <button type="button" disabled={saving}
              title="Вернуть автоматический расчёт" aria-label={'Сбросить ручной максимум ' + id}
              onClick={() => resetMax(id)}><RotateCcw size={12} /></button>}
          </div>
        </div>
      </div>;
    })}
  </div>;

  return <main className="page moon-editor">
    <div className="pf-toolbar moon-toolbar">
      <button type="button" className="text-button" disabled={saving} onClick={() => void back()}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <h1 className="pf-minimal-title moon-toolbar-title">Лист персонажа Pr. Moon</h1>
      <div className="pf-toolbar-right">
        <span className={'pf-save-status' + (dirty ? ' pf-unsaved' : '')} aria-live="polite">
          {saving ? 'Сохранение…' : dirty ? 'Есть изменения' : 'Сохранено'}
        </span>
        <div className="pf-settings-area moon-settings-area">
          <button type="button" className="pf-settings-button" aria-label="Настройки листа"
            aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>
            <Settings2 size={17} /> <span>Настройки</span>
          </button>
          {settingsOpen && <div className="pf-settings-popover moon-settings-popover" role="group"
            aria-label="Настройки Project Moon">
            <label className="pf-settings-option">
              <input type="checkbox" disabled={saving} checked={sheet.autoVitals}
                onChange={event => setSheet(old => ({ ...old, autoVitals: event.target.checked }))} />
              Автоматический подсчёт HP / ST / SP
            </label>
            <p>Показатели можно изменить вручную в любой момент.</p>
          </div>}
        </div>
        <button type="button" className="button button-primary" disabled={saving || !dirty}
          onClick={() => void save()}><Cloud size={16} /> Сохранить</button>
      </div>
    </div>

    <nav className="moon-tabs" aria-label="Страницы Project Moon">
      {MOON_PAGES.map(({ id, title }, index) =>
        <button key={id} type="button" className={page === id ? 'moon-tab moon-tab-active' : 'moon-tab'}
          aria-current={page === id ? 'page' : undefined} onClick={() => selectPage(id)}>
          <span>{String(index + 1).padStart(2, '0')}</span> {title}
        </button>)}
    </nav>

    <article className={'moon-paper moon-page-' + page}
      aria-label={'Страница: ' + MOON_PAGES.find(p => p.id === page)?.title}>
      <header className="moon-page-heading">
        <span>PROJECT MOON</span>
        <h2>{MOON_PAGES.find(item => item.id === page)?.title}</h2>
      </header>

      {page === 'dossier' && <>
        <div className="moon-dossier-top">
          <div className="moon-dossier-fields">
            <label className="moon-field moon-name"><span>ИМЯ ПЕРСОНАЖА</span>
              <input type="text" disabled={saving} maxLength={100} value={name}
                onChange={event => setName(event.target.value)} placeholder="Имя персонажа" />
            </label>
            <div className="moon-identity-pairs">
              <div className="moon-identity-group">
                <div className="moon-small-label">ЗАНЯТИЕ / ОРГАНИЗАЦИЯ</div>
                <div className="moon-identity-inner">
                  {field('Занятие', 'occupation')}
                  {field('Организация', 'organization')}
                </div>
              </div>
              <div className="moon-identity-group">
                <div className="moon-small-label">РАЙОН / ФРАКЦИЯ</div>
                <div className="moon-identity-inner">
                  {field('Район', 'district')}
                  {field('Фракция', 'faction')}
                </div>
              </div>
            </div>
            <div className="moon-primary-stats">
              {field('Ранг', 'rank')}
              {field('Уровень', 'level')}
              {field('EXP', 'exp')}
              {field('₳', 'money')}
            </div>
          </div>
          <button type="button" className="moon-portrait-button" onClick={onEditPortrait} aria-label="Изменить портрет">
            <span className="moon-portrait-window">
              {portraitUrl ? <PortraitImage url={portraitUrl} frame={portraitFrame} /> :
                <span className="moon-portrait-empty">ПОРТРЕТ<br />Добавить изображение</span>}
            </span>
          </button>
        </div>
        <section className="moon-section">
          {sectionTitle(1, 'Характеристики')}
          <div className="moon-attributes">
            {MOON_ATTRIBUTES.map(item =>
              <label className="moon-attribute" key={item.id}>
                <span className="moon-attribute-label">{item.label}<small>{item.english}</small></span>
                <input inputMode="numeric" type="text" maxLength={4} disabled={saving}
                  value={sheet.fields[item.id] ?? ''} onChange={event => change(item.id, event.target.value)}
                  placeholder="—" aria-label={item.label} />
              </label>)}
          </div>
        </section>
        <section className="moon-section">
          {sectionTitle(2, 'Ресурсы / HP · ST · SP · L')}
          {resourceCards()}
        </section>
        <section className="moon-section moon-inventory">
          {sectionTitle(3, 'Инвентарь')}
          {longField('Инвентарь', 'inventory', 'Предметы, снаряжение и заметки…', 'moon-lined')}
        </section>
      </>}

      {page === 'combat' && <>
        <section className="moon-section moon-first-section">
          {sectionTitle(1, 'Боевые показатели')}
          <div className="moon-combat-fields">
            {field('Скорость', 'speed', '1к6 + Решительность')}
            {field('Движение', 'movement', '6 клеток')}
            {field('Действия', 'actions', 'По рангу')}
            {field('Реакции', 'reactions', 'По рангу')}
            <label className="moon-field">
              <span>Атака</span>
              <small>+Ранг</small>
              <input readOnly type="text" value={moonAttackBonus(sheet)} placeholder="—" aria-label="Бонус атаки" />
            </label>
            {field('Блок', 'blockBonus', '+Самообладание')}
            {field('Уклонение', 'evadeBonus', '+Проницательность')}
          </div>
        </section>
        <section className="moon-section">
          {sectionTitle(2, 'Основное оружие')}
          <div className="moon-two-columns">
            {sheet.weapons.map((weapon, index) => <div className="moon-card moon-weapon-card" key={weapon.id}>
              <div className="moon-card-heading">
                <strong>ОРУЖИЕ {index === 0 ? 'A' : 'B'}</strong>
                <span className="moon-card-meta">
                  <label>РАНГ <input aria-label={'Ранг оружия ' + (index + 1)} disabled={saving}
                    value={weapon.rank ?? ''} onChange={e => updateWeapon(index, {rank:e.target.value})} /></label>
                  <label>EP <input aria-label={'EP оружия ' + (index + 1)} disabled={saving}
                    value={weapon.ep ?? ''} onChange={e => updateWeapon(index, {ep:e.target.value})} /></label>
                </span>
              </div>
              <label className="moon-compact-field"><strong>Название:</strong>
                <input disabled={saving} value={weapon.name} onChange={e=>updateWeapon(index,{name:e.target.value})}
                  aria-label={'Название оружия ' + (index + 1)} /></label>
              <div className="moon-choice-row"><span>Тип:</span>
                {['ближнее','дальнее'].map(value=><label key={value}><input type="radio" disabled={saving}
                  name={'moon-weapon-kind-' + index} checked={(weapon.kind ?? '')===value}
                  onChange={()=>updateWeapon(index,{kind:value})}/>{value}</label>)}
              </div>
              <div className="moon-choice-row"><span>Урон:</span>
                {['Slash','Pierce','Blunt'].map(value=><label key={value}><input type="radio" disabled={saving}
                  name={'moon-weapon-damage-' + index} checked={(weapon.damage ?? '')===value}
                  onChange={()=>updateWeapon(index,{damage:value})}/>{value}</label>)}
              </div>
              <div className="moon-weapon-secondary">
                <label>Кости <input disabled={saving} aria-label={'Кости оружия ' + (index + 1)}
                  value={weapon.dice} onChange={e=>updateWeapon(index,{dice:e.target.value})} /></label>
                <label>Форма <input disabled={saving} aria-label={'Форма оружия ' + (index + 1)}
                  value={weapon.form ?? ''} onChange={e=>updateWeapon(index,{form:e.target.value})} /></label>
              </div>
              <label className="moon-compact-field"><span>Хват / свойства:</span>
                <input disabled={saving} value={weapon.grip ?? ''} onChange={e=>updateWeapon(index,{grip:e.target.value})}
                  aria-label={'Хват и свойства оружия ' + (index + 1)} /></label>
              <div className="moon-rich-group"><span>ЭФФЕКТЫ / УСЛОВИЯ</span>
                <RichField id={'moon-' + weapon.id} label={'Эффекты оружия ' + (index + 1)}
                  value={weapon.description} onChange={value=>updateWeapon(index,{description:value})}
                  disabled={saving} grow placeholder="Эффекты и условия…" />
              </div>
              <label className="moon-compact-field moon-bonus-field"><span>Доп. бонус:</span>
                <input disabled={saving} value={weapon.bonus} onChange={e=>updateWeapon(index,{bonus:e.target.value})}
                  aria-label={'Дополнительный бонус оружия ' + (index + 1)} /></label>
            </div>)}
          </div>
        </section>
        <section className="moon-section">
          {sectionTitle(3, 'Сопротивления / Состояния')}
          <div className="moon-resistance-layout">
            <table className="moon-data-table" aria-label="Сопротивления">
              <thead><tr><th>УРОН</th><th>SLASH</th><th>PIERCE</th><th>BLUNT</th></tr></thead>
              <tbody>{['HP','ST'].map(kind=><tr key={kind}>
                <th>{kind} ×</th>
                {['slash','pierce','blunt'].map(damage=><td key={damage}>
                  <input disabled={saving} aria-label={kind + ' ' + damage}
                    value={sheet.fields['resistance' + kind + damage] ??
                      (damage === 'slash' ? (sheet.fields['resistance' + kind.charAt(0) + kind.slice(1).toLowerCase()] ?? '') : '')}
                    onChange={e=>change('resistance' + kind + damage,e.target.value)}/>
                </td>)}
              </tr>)}</tbody>
            </table>
            <div>
              <table className="moon-data-table" aria-label="Состояния">
                <thead><tr><th>СОСТОЯНИЕ</th><th>СТАКИ</th><th>СРОК</th></tr></thead>
                <tbody>{[1,2].map(index=><tr key={index}>
                  {['Name','Stacks','Duration'].map(key=><td key={key}><input disabled={saving}
                    aria-label={'Состояние ' + index + ' ' + key}
                    value={sheet.fields['condition' + key + index] ?? ''}
                    onChange={e=>change('condition' + key + index,e.target.value)}/></td>)}
                </tr>)}</tbody>
              </table>
              <div className="moon-conditions-extra"><RichField id="moon-conditions" label="Дополнительные состояния"
                value={sheet.fields.conditions ?? ''} onChange={value=>change('conditions',value)}
                disabled={saving} grow placeholder="Другие состояния…" /></div>
            </div>
          </div>
        </section>
        <section className="moon-section">
          {sectionTitle(4, 'Боевые приёмы / Skills')}
          <div className="moon-two-columns moon-skills">
            {sheet.skills.map((skill, index) => <div className="moon-card moon-skill-card" key={skill.id}>
              <div className="moon-card-heading">
                <strong>ПРИЁМ {String(index + 1).padStart(2, '0')}</strong>
                <span className="moon-card-meta">
                  {(['rank','light','ep'] as const).map((key)=><label key={key}>{key.toUpperCase()}
                    <input disabled={saving} aria-label={key + ' приёма ' + (index + 1)}
                      value={skill[key] ?? ''} onChange={e=>updateSkill(index,{[key]:e.target.value})}/></label>)}
                  <button type="button" title="Удалить приём" aria-label={'Удалить приём ' + (index + 1)}
                    disabled={saving} onClick={()=>setSheet(old=>({
                      ...old,skills:old.skills.filter(entry=>entry.id!==skill.id)
                    }))}><Trash2 size={14}/></button>
                </span>
              </div>
              <label className="moon-compact-field"><strong>Название:</strong>
                <input disabled={saving} value={skill.title}
                  onChange={e=>updateSkill(index,{title:e.target.value})}
                  aria-label={'Название приёма ' + (index + 1)}/></label>
              <div className="moon-choice-row"><span>Тип:</span>
                {['атака','блок','уклонение','проверка'].map(value=><label key={value}>
                  <input type="radio" disabled={saving} name={'moon-skill-type-' + skill.id}
                    checked={(skill.type ?? '') === value} onChange={()=>updateSkill(index,{type:value})}/>{value}
                </label>)}
              </div>
              <div className="moon-rich-group"><span>УСЛОВИЯ / ЭФФЕКТ:</span>
                <RichField id={'moon-' + skill.id} label={'Приём ' + (index + 1)}
                  value={skill.body} onChange={value=>updateSkill(index,{body:value})}
                  disabled={saving} grow placeholder="Условия, эффекты и описание…" />
              </div>
            </div>)}
          </div>
          <button type="button" className="moon-add" disabled={saving || sheet.skills.length >= 100}
            onClick={() => setSheet(old => addMoonSkill(old, 'skill-' + crypto.randomUUID()))}>
            <Plus size={16} /> Добавить приём
          </button>
        </section>
      </>}

      {page === 'about' && <>
        <section className="moon-section moon-first-section">
          {sectionTitle(1, 'Личные данные')}
          <div className="moon-about-info">
            {field('Профессия / Занятие', 'occupation')}
            {field('Организация / Принадлежность', 'organization')}
            {field('Возраст', 'age')}
            {field('Рост', 'height')}
          </div>
        </section>
        <section className="moon-section">{sectionTitle(2, 'Внешность / Описание')}
          {longField('Внешность', 'appearance', 'Описание внешности…', 'moon-lined moon-about-appearance')}
        </section>
        <section className="moon-section">{sectionTitle(3, 'Предыстория / Мотивация')}
          <div className="moon-about-duo">
            {longField('Предыстория', 'backstory', 'История персонажа…', 'moon-lined')}
            {longField('Мотивация', 'motivation', 'Цели и стремления…', 'moon-lined')}
          </div>
        </section>
        <section className="moon-section">{sectionTitle(4, 'Характер / Убеждения')}
          {longField('Характер', 'personality', 'Характер и убеждения…', 'moon-lined moon-about-personality')}
        </section>
      </>}

      {page === 'notes' && <div className="moon-two-columns moon-notes">
        {sheet.notes.map((note, index) => <section className="moon-card moon-note" key={note.id}>
          <div className="moon-note-heading">
            <input type="text" disabled={saving} maxLength={120}
              aria-label={'Заголовок заметки ' + (index + 1)} value={note.title}
              onChange={event => updateNote(index, { title: event.target.value })}
              placeholder={'ЗАМЕТКИ ' + String(index + 1).padStart(2,'0')} />
          </div>
          <RichField id={'moon-' + note.id} label={'Заметка ' + (index + 1)}
            value={note.body} onChange={value => updateNote(index, { body: value })}
            disabled={saving} grow placeholder="Текст заметки…" />
        </section>)}
      </div>}
    </article>
    {error && <p role="alert" className="form-error">{error}</p>}
  </main>;
}

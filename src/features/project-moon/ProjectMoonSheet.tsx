import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Cloud, Files, Plus, RotateCcw, Settings2, Trash2, X } from 'lucide-react';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import PortraitImage from '../portrait/PortraitImage';
import RichField from '../pathfinder/RichField';
import type { CropFrame } from '../portrait/crop';
import {
  MOON_PAGES, MOON_ATTRIBUTES, readMoonSheet, saveMoonSheet,
  moonCalculatedMax, moonDisplayedMax, moonAttackBonus, addMoonSkill, addMoonWeapon, moonWeaponLetter,
} from './model';
import type { MoonPage, MoonResourceId, MoonItem, MoonWeapon } from './model';
import MoonPageSettingsDialog from './MoonPageSettingsDialog';
import { supabase } from '../../lib/supabase';
import { MOON_LAYOUT_KEY, DEFAULT_MOON_LAYOUT, parseMoonLayout, moonLayoutVariables } from './layout-settings';
import type { MoonLayout } from './layout-settings';
import './ProjectMoonSheet.css';

const RESOURCES: { id: MoonResourceId; short: string; label: string }[] = [
  { id: 'hp', short: 'HP', label: 'Здоровье' },
  { id: 'st', short: 'ST', label: 'Ошеломление' },
  { id: 'sp', short: 'SP', label: 'Рассудок' },
  { id: 'light', short: 'L', label: 'Свет' },
];
type Props = {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
  portraitUrl?: string;
  portraitFrame?: CropFrame;
  onEditPortrait: () => void;
  layoutOverride?: MoonLayout;
  previewMode?: boolean;
};

export default function ProjectMoonSheet({ character, onSave, onClose, portraitUrl, portraitFrame, onEditPortrait, layoutOverride, previewMode = false }: Props) {
  const [name, setName] = useState(character.name);
  const [sheet, setSheet] = useState(() => readMoonSheet(character.details));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weaponOffset, setWeaponOffset] = useState(0);
  const weaponViewportRef = useRef<HTMLDivElement>(null);
  const [compactWeapons, setCompactWeapons] = useState(() => window.matchMedia('(max-width: 660px)').matches);
  const visibleWeapons = compactWeapons ? 1 : 2;
  const maxWeaponOffset = Math.max(0, sheet.weapons.length - visibleWeapons);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 660px)');
    const update = () => setCompactWeapons(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (weaponOffset > maxWeaponOffset) setWeaponOffset(maxWeaponOffset);
  }, [weaponOffset, maxWeaponOffset]);
  useEffect(() => {
    const viewport = weaponViewportRef.current;
    const cards = viewport?.querySelectorAll<HTMLElement>('.moon-weapon-card');
    if (!viewport || !cards?.length) return;
    const target = cards[Math.min(weaponOffset, cards.length - 1)].offsetLeft - cards[0].offsetLeft;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      left: target,
      behavior: sheet.smoothWeaponSwitch && !reducedMotion ? 'smooth' : 'instant',
    });
  }, [weaponOffset, sheet.smoothWeaponSwitch, sheet.weapons.length, compactWeapons]);
  const addWeapon = () => {
    if (saving || sheet.weapons.length >= 100) return;
    const length = sheet.weapons.length;
    setSheet(old => addMoonWeapon(old, 'weapon-' + crypto.randomUUID()));
    setWeaponOffset(Math.max(0, length + 1 - visibleWeapons));
  };
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [navigationHelp, setNavigationHelp] = useState<boolean>(() => {
    try { return window.localStorage.getItem('ays-prmoon-navigation-help') === '1'; }
    catch { return false; }
  });
  const [activePage, setActivePage] = useState<MoonPage>('dossier');
  const pageOrder = sheet.pageOrder;
  useEffect(() => {
    try { window.localStorage.setItem('ays-prmoon-navigation-help', navigationHelp ? '1' : '0'); }
    catch { /* Navigation remains usable without local storage. */ }
  }, [navigationHelp]);
  useEffect(() => {
    if (!navigationHelp || previewMode) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: MoonPage = pageOrder[0] ?? 'dossier';
      for (const page of pageOrder) {
        const rect = document.getElementById('moon-sheet-page-' + page)?.getBoundingClientRect();
        if (rect && rect.top <= window.innerHeight * .33) current = page;
      }
      setActivePage(current);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [navigationHelp, previewMode, pageOrder]);
  function navigatePage(page: MoonPage) {
    document.getElementById('moon-sheet-page-' + page)?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    setActivePage(page);
  }
  const changePageOrder = (order: MoonPage[]) =>
    setSheet(old => ({ ...old, pageOrder: order }));
  const [publishedLayout, setPublishedLayout] = useState<MoonLayout>(DEFAULT_MOON_LAYOUT);
  useEffect(() => {
    if (previewMode || !supabase) return;
    let current = true;
    void supabase.from('sheet_templates').select('fields').eq('template_key', MOON_LAYOUT_KEY).maybeSingle()
      .then(({data,error}) => { if (current && !error && data?.fields) setPublishedLayout(parseMoonLayout(data.fields)); });
    return () => { current = false; };
  }, [previewMode]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify([character.name, readMoonSheet(character.details)]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify([name, sheet]) !== savedSnapshot;

  useEffect(() => {
    if (!dirty || previewMode) return;
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
  const updateWeaponById = (id: string, patch: Partial<MoonWeapon>) =>
    setSheet(old => ({ ...old, weapons: old.weapons.map(entry => entry.id === id ? { ...entry, ...patch } : entry) }));
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

  return <main className="page moon-editor" style={moonLayoutVariables(layoutOverride ?? publishedLayout) as CSSProperties}>
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
            <label className="pf-settings-option">
              <input type="checkbox" disabled={saving} checked={sheet.smoothWeaponSwitch}
                onChange={event => setSheet(old => ({...old, smoothWeaponSwitch: event.target.checked}))}/>
              Плавная анимация переключения
            </label>
            <label className="pf-settings-option">
              <input type="checkbox" checked={navigationHelp} onChange={event => setNavigationHelp(event.target.checked)}/>
              Помощь в навигации
            </label>
            <button type="button" className="pf-settings-pages-button"
              onClick={() => { setSettingsOpen(false); setPageSettingsOpen(true); }}>
              <Files size={16}/> Страницы листа…
            </button>
            <p>Показатели можно изменить вручную в любой момент.</p>
          </div>}
        </div>
        <button type="button" className="button button-primary" disabled={saving || !dirty}
          onClick={() => void save()}><Cloud size={16} /> Сохранить</button>
      </div>
    </div>

    <div className="moon-sheet-scroll" aria-label="Страницы листа Project Moon">
      {pageOrder.map(page => <article key={page} id={'moon-sheet-page-' + page}
        className={'moon-paper moon-page-' + page}
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
          <div className="moon-weapon-section-heading">
            {sectionTitle(2, 'Основное оружие')}
            <div className="moon-weapon-pagination" role="group" aria-label="Переключение оружия">
              <button type="button" aria-label="Предыдущее оружие" title="Предыдущее оружие"
                disabled={weaponOffset === 0}
                onClick={() => setWeaponOffset(value => Math.max(0,value-1))}><ChevronLeft size={17}/></button>
              <span aria-live="polite">
                {moonWeaponLetter(weaponOffset)}–{moonWeaponLetter(Math.min(weaponOffset + visibleWeapons - 1,sheet.weapons.length-1))}
                <small> / {sheet.weapons.length}</small>
              </span>
              <button type="button" aria-label="Следующее оружие" title="Следующее оружие"
                disabled={weaponOffset >= maxWeaponOffset}
                onClick={() => setWeaponOffset(value => Math.min(maxWeaponOffset,value+1))}><ChevronRight size={17}/></button>
              <button type="button" className="moon-add-weapon-mobile" aria-label="Добавить оружие"
                title="Добавить оружие" disabled={saving || sheet.weapons.length >= 100}
                onClick={addWeapon}><Plus size={16}/></button>
            </div>
          </div>
          <div className="moon-weapon-carousel" ref={weaponViewportRef} aria-label="Карточки оружия">
            <div className="moon-weapon-track">
              {sheet.weapons.map((weapon, index) => <div className="moon-card moon-weapon-card" key={weapon.id}
                inert={index < weaponOffset || index >= weaponOffset + visibleWeapons}>
                <div className="moon-card-heading moon-weapon-heading">
                  <input type="text" className="moon-weapon-title" maxLength={160} disabled={saving}
                    aria-label={'Название оружия ' + moonWeaponLetter(index)}
                    value={weapon.name}
                    placeholder={'ОРУЖИЕ ' + moonWeaponLetter(index)}
                    onChange={event => updateWeaponById(weapon.id,{name:event.target.value})}/>
                  <span className="moon-card-meta">
                    <label>РАНГ <input aria-label={'Ранг оружия ' + (index + 1)} disabled={saving}
                      value={weapon.rank ?? ''} onChange={e => updateWeaponById(weapon.id,{rank:e.target.value})} /></label>
                    <label>EP <input aria-label={'EP оружия ' + (index + 1)} disabled={saving}
                      value={weapon.ep ?? ''} onChange={e => updateWeaponById(weapon.id,{ep:e.target.value})} /></label>
                    {index === weaponOffset + visibleWeapons - 1 &&
                      <button type="button" className="moon-add-weapon" title="Добавить оружие"
                        aria-label="Добавить оружие" disabled={saving || sheet.weapons.length >= 100}
                        onClick={addWeapon}><Plus size={15}/></button>}
                  </span>
                </div>
                <div className="moon-choice-row"><span>Тип:</span>
                  {['ближнее','дальнее'].map(value=><label key={value}><input type="radio" disabled={saving}
                    name={'moon-weapon-kind-' + weapon.id} checked={(weapon.kind ?? '')===value}
                    onChange={()=>updateWeaponById(weapon.id,{kind:value})}/>{value}</label>)}
                </div>
                <div className="moon-choice-row"><span>Урон:</span>
                  {[{value:'Slash',label:'Режущий'},{value:'Pierce',label:'Колющий'},{value:'Blunt',label:'Дробящий'}]
                    .map(({value,label})=><label key={value}><input type="radio" disabled={saving}
                    name={'moon-weapon-damage-' + weapon.id} checked={(weapon.damage ?? '')===value}
                    onChange={()=>updateWeaponById(weapon.id,{damage:value})}/>{label}</label>)}
                </div>
                <div className="moon-weapon-secondary">
                  <label>Кости <input disabled={saving} aria-label={'Кости оружия ' + (index + 1)}
                    value={weapon.dice} onChange={e=>updateWeaponById(weapon.id,{dice:e.target.value})} /></label>
                  <label>Форма <input disabled={saving} aria-label={'Форма оружия ' + (index + 1)}
                    value={weapon.form ?? ''} onChange={e=>updateWeaponById(weapon.id,{form:e.target.value})} /></label>
                </div>
                <label className="moon-compact-field"><span>Хват / свойства:</span>
                  <input disabled={saving} value={weapon.grip ?? ''} onChange={e=>updateWeaponById(weapon.id,{grip:e.target.value})}
                    aria-label={'Хват и свойства оружия ' + (index + 1)} /></label>
                <div className="moon-rich-group"><span>ЭФФЕКТЫ / УСЛОВИЯ</span>
                  <RichField id={'moon-' + weapon.id} label={'Эффекты оружия ' + (index + 1)}
                    value={weapon.description} onChange={value=>updateWeaponById(weapon.id,{description:value})}
                    disabled={saving} grow placeholder="Эффекты и условия…" />
                </div>
                <label className="moon-compact-field moon-bonus-field"><span>Доп. бонус:</span>
                  <input disabled={saving} value={weapon.bonus} onChange={e=>updateWeaponById(weapon.id,{bonus:e.target.value})}
                    aria-label={'Дополнительный бонус оружия ' + (index + 1)} /></label>
              </div>)}
            </div>
          </div>
        </section>
        <section className="moon-section">
          {sectionTitle(3, 'Сопротивления / Состояния')}
          <div className="moon-resistance-layout">
            <table className="moon-data-table" aria-label="Сопротивления">
              <thead><tr><th>УРОН</th><th>РЕЖУЩИЙ</th><th>КОЛЮЩИЙ</th><th>ДРОБЯЩИЙ</th></tr></thead>
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
      </article>)}
    </div>
    {pageSettingsOpen && <MoonPageSettingsDialog
      order={pageOrder} disabled={saving} onOrderChange={changePageOrder}
      onClose={() => setPageSettingsOpen(false)} />}
    {!previewMode && navigationHelp && <nav className="pf-navigation-help" aria-label="Быстрая навигация по листу">
      <div className="pf-navigation-help-title">
        <span>Страницы</span>
        <button type="button" onClick={() => setNavigationHelp(false)} aria-label="Скрыть помощь в навигации">
          <X size={14}/>
        </button>
      </div>
      {pageOrder.map((page,index) => <button key={page} type="button"
        className={'pf-navigation-help-link' + (activePage === page ? ' pf-navigation-help-active' : '')}
        onClick={() => navigatePage(page)}
        aria-label={'Страница ' + (index + 1) + ': ' + MOON_PAGES.find(p => p.id === page)?.title}
        aria-current={activePage === page ? 'page' : undefined}
        title={MOON_PAGES.find(p => p.id === page)?.title}>
        <span className="pf-navigation-help-number">{index + 1}</span>
        <span className="pf-navigation-help-label">{MOON_PAGES.find(p => p.id === page)?.title}</span>
      </button>)}
    </nav>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </main>;
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Files, Plus, RotateCcw, Settings2, Trash2, X, FileDown } from 'lucide-react';
import AutoSaveStatus from '../../lib/AutoSaveStatus';
import DiceRollPanel from '../../lib/DiceRollPanel';
import {exportRenderedSheetPdf} from '../../lib/sheet-pdf';
import '../../lib/sheet-pdf.css';
import {useAutoSave} from '../../lib/use-auto-save';
import {characterDraftKey,recoverLocalDraft} from '../../lib/local-drafts';
import type { Character, CharacterDetails } from '../../lib/models';
import { normalizedName } from '../../lib/models';
import {setPageVisible,visiblePageIds} from '../../lib/page-visibility';
import MoonPortrait from './MoonPortrait';
import RichField from '../pathfinder/RichField';
import type { CropFrame } from '../portrait/crop';
import {
  MOON_PAGES, MOON_ATTRIBUTES, readMoonSheet, saveMoonSheet,
  moonCalculatedMax, moonDisplayedMax, moonAttackBonus, moonDamageEstimate, addMoonSkill, updateMoonSkill, removeMoonSkill, moonOffsetAfterWeaponRemoval, addMoonWeapon, removeMoonWeapon, moonWeaponLetter,
} from './model';
import type { MoonPage, MoonResourceId, MoonItem, MoonWeapon } from './model';
import MoonPageSettingsDialog from './MoonPageSettingsDialog';
import FloatingPageNavigation from '../pathfinder/FloatingPageNavigation';
import MoonWeaponDeleteDialog from './MoonWeaponDeleteDialog';
import MoonEquipmentPage from './MoonEquipmentPage';
import { DEFAULT_MOON_LAYOUT, moonLayoutVariables } from './layout-settings';
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
  autoExport?: boolean;
  onAutoExportComplete?: () => void;
};

export default function ProjectMoonSheet({ character, onSave, onClose, portraitUrl, portraitFrame, onEditPortrait, layoutOverride, previewMode = false, autoExport=false, onAutoExportComplete }: Props) {
  const draftKey=characterDraftKey(character.user_id,character.id);
  const pdfRoot=useRef<HTMLElement>(null);
  const pdfInFlight=useRef(false);
  const pdfAutoStarted=useRef(false);
  const [exportingPdf,setExportingPdf]=useState(false);
  const [pdfError,setPdfError]=useState('');
  async function exportPdf(){
    if(pdfInFlight.current||!pdfRoot.current)return;
    pdfInFlight.current=true;setExportingPdf(true);setPdfError('');
    try{await exportRenderedSheetPdf(pdfRoot.current,name,'prmoon');}
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


  const [serverBaseline]=useState(()=>JSON.stringify([character.name,readMoonSheet(character.details)]));
  const [recovered]=useState(()=>{
    if(previewMode)return null;
    const draft=recoverLocalDraft(draftKey,serverBaseline);
    if(!draft)return null;
    try {
      const parsed:unknown=JSON.parse(draft);
      if(Array.isArray(parsed)&&typeof parsed[0]==='string'&&parsed[1]&&typeof parsed[1]==='object')
        return {name:parsed[0] as string,sheet:readMoonSheet({projectMoonSheet:parsed[1]})};
    }catch{ /* Do not use invalid drafts. */ }
    return null;
  });
  const [name,setName]=useState(()=>recovered?.name??character.name);
  const [sheet,setSheet]=useState(()=>recovered?.sheet??readMoonSheet(character.details));
  // Transient calculator inputs: never persisted or applied to resources.
  const [damageCalculatorOpen,setDamageCalculatorOpen]=useState(false);
  const [damageType,setDamageType]=useState<'slash'|'pierce'|'blunt'>('slash');
  const [damageRoll,setDamageRoll]=useState('');
  const [damageAfterHp,setDamageAfterHp]=useState('');
  const [damageAfterSt,setDamageAfterSt]=useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weaponOffset, setWeaponOffset] = useState(0);
  const [pendingWeaponDelete, setPendingWeaponDelete] = useState<string | null>(null);
  const [pendingSkillDelete, setPendingSkillDelete] = useState<string | null>(null);
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
    if (editLocked || sheet.weapons.length >= 100) return;
    const length = sheet.weapons.length;
    setSheet(old => addMoonWeapon(old, 'weapon-' + crypto.randomUUID()));
    setWeaponOffset(Math.max(0, length + 1 - visibleWeapons));
  };
  const deleteWeapon = (id: string) => {
    if (editLocked || sheet.weapons.length <= 2) return;
    if (!sheet.weapons.some(weapon => weapon.id === id)) return;
    setPendingWeaponDelete(id);
  };
  const confirmWeaponDeletion = () => {
    if (!pendingWeaponDelete || editLocked) return;
    setSheet(old => removeMoonWeapon(old, pendingWeaponDelete));
    setWeaponOffset(old => moonOffsetAfterWeaponRemoval(old, sheet.weapons.length - 1, visibleWeapons));
    setPendingWeaponDelete(null);
  };
  const pendingWeaponIndex = pendingWeaponDelete === null
    ? -1 : sheet.weapons.findIndex(weapon => weapon.id === pendingWeaponDelete);
  const pendingSkillIndex = pendingSkillDelete === null
    ? -1 : sheet.skills.findIndex(skill => skill.id === pendingSkillDelete);
  const confirmSkillDeletion = () => {
    if (!pendingSkillDelete || editLocked) return;
    setSheet(old => removeMoonSkill(old, pendingSkillDelete));
    setPendingSkillDelete(null);
  };
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [navigationHelp, setNavigationHelp] = useState<boolean>(() => {
    try { return window.localStorage.getItem('ays-prmoon-navigation-help') === '1'; }
    catch { return false; }
  });
  const [activePage, setActivePage] = useState<MoonPage>('dossier');
  // On mobile the browser may restore the dashboard's old scroll offset after
  // React mounts the long sheet, making its last page (Notes) appear first.
  // Reset after layout and once more after the next paint to beat restoration.
  // This is intentionally mount-only: never interfere with page navigation.
  useLayoutEffect(() => {
    if (previewMode) return;
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const pageOrder = sheet.pageOrder;
  const visibleMoonPages = useMemo(()=>previewMode?pageOrder:visiblePageIds(pageOrder,sheet.hiddenPages),[previewMode,pageOrder,sheet.hiddenPages]);
  useEffect(() => {
    try { window.localStorage.setItem('ays-prmoon-navigation-help', navigationHelp ? '1' : '0'); }
    catch { /* Navigation remains usable without local storage. */ }
  }, [navigationHelp]);
  useEffect(() => {
    if (!navigationHelp || previewMode) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: MoonPage = visibleMoonPages[0] ?? 'dossier';
      for (const page of visibleMoonPages) {
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
  }, [navigationHelp, previewMode, visibleMoonPages]);
  function navigatePage(page: MoonPage) {
    document.getElementById('moon-sheet-page-' + page)?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    setActivePage(page);
  }
  const changePageOrder = (order: MoonPage[]) =>
    setSheet(old => ({ ...old, pageOrder: order }));
  const changePageVisibility = (page: MoonPage, visible: boolean) =>
    setSheet(old => ({...old, hiddenPages:setPageVisible(old.pageOrder,old.hiddenPages,page,visible)}));
  // The approved published appearance is the only normal sheet layout.
  // The administration preview can still supply an explicit layoutOverride.
  // Never swap geometry asynchronously after the sheet becomes visible.
  // Cloud autosaves are serialized; players can continue editing during them.
  // Individual text overrides are scoped to stable page/element selectors.
  // The DOM index is local to a single page and text category.
  useEffect(()=>{
    const root=pdfRoot.current;
    if(!root)return;
    const selectors:Record<string,string>={
      pageKicker:'.moon-page-heading > span',pageTitle:'.moon-page-heading > h2',
      sectionTitle:'.moon-section-title',fieldLabel:'.moon-field > span',fieldValue:'.moon-field input',
      characterName:'.moon-name input',attributeLabel:'.moon-attribute-label',
      resourceTitle:'.moon-resource-title',cardTitle:'.moon-weapon-title',
      noteTitle:'.moon-notes-title',bodyText:'.moon-long-field .pf-rich-editable, .moon-rich-group .pf-rich-editable, .moon-note .pf-rich-editable, .moon-conditions-extra .pf-rich-editable',
    };
    const layout=layoutOverride ?? DEFAULT_MOON_LAYOUT;
    for(const page of ['dossier','combat','equipment','about','notes']){
      const paper=root.querySelector('.moon-page-'+page);
      if(!paper)continue;
      for(const [group,selector] of Object.entries(selectors)){
        const nodes=paper.querySelectorAll<HTMLElement>(selector);
        nodes.forEach((node,index)=>{
          const override=layout.elementStyles?.[`moon-page-${page}|${group}:${index}`];
          if(!override){
            node.style.width='';node.style.height='';node.style.maxWidth='';
            node.style.fontSize='';node.style.fontWeight='';node.style.fontStyle='';
            node.style.letterSpacing='';node.style.lineHeight='';node.style.textAlign='';node.style.fontFamily='';
            return;
          }
          node.style.width=override.boxWidth!==undefined?override.boxWidth+'px':'';
          node.style.maxWidth=override.boxWidth!==undefined?'100%':'';
          node.style.height=override.boxHeight!==undefined?override.boxHeight+'px':'';
          node.style.fontSize=override.size!==undefined?override.size+'px':'';
          node.style.fontWeight=override.weight!==undefined?String(override.weight):'';
          node.style.fontStyle=override.italic?'italic':'normal';
          node.style.letterSpacing=override.letterSpacing!==undefined?override.letterSpacing+'px':'';
          node.style.lineHeight=override.lineHeight!==undefined?String(override.lineHeight):'';
          node.style.textAlign=override.align??'';
          node.style.fontFamily=override.family==='serif'?'Georgia,serif':override.family==='mono'?'monospace':'';
        });
      }
    }
  },[layoutOverride]);
  const editLocked=previewMode;
  const auto=useAutoSave({
    snapshot:JSON.stringify([name,sheet]),initialSnapshot:serverBaseline,
    draftKey,enabled:!previewMode,
    persist:async serialized=>{
      const [capturedName,capturedSheet]=JSON.parse(serialized) as [string,typeof sheet];
      const cleanName=normalizedName(capturedName);
      if(!cleanName)throw new Error('Укажи имя персонажа.');
      return onSave(character.id,cleanName,saveMoonSheet(character.details,capturedSheet));
    },
  });
  const {error}=auto;

  useEffect(() => {
    if (!settingsOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [settingsOpen]);

  const change = (key: string, value: string) =>
    setSheet(old => ({ ...old, fields: { ...old.fields, [key]: value } }));
  const updateSkill = (id: string, patch: Partial<MoonItem>) =>
    setSheet(old => updateMoonSkill(old, id, patch));
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

  async function back() {
    if(!(await auto.saveNow()))return; // return only after latest edits reach cloud
    onClose();
  }
  const field = (label: string, key: string, placeholder = '', extraClass = '') =>
    <label className={'moon-field ' + extraClass} key={key}>
      <span>{label}</span>
      <input type="text" disabled={editLocked} value={sheet.fields[key] ?? ''} placeholder={placeholder}
        onChange={event => change(key, event.target.value)} maxLength={220} />
    </label>;
  const textSizeControls = (key: string) => <div className="moon-text-size-controls" role="group" aria-label={'Размер текста: ' + key}>
    <span className="moon-text-size-value" aria-live="polite">{sheet.textSizes[key] ?? 12}</span>
    <button type="button" disabled={editLocked || (sheet.textSizes[key] ?? 12) >= 28}
      aria-label="Увеличить размер текста" title="Увеличить текст"
      onClick={() => setSheet(old => ({ ...old, textSizes: { ...old.textSizes, [key]: Math.min(28, (old.textSizes[key] ?? 12) + 1) } }))}>+</button>
    <button type="button" disabled={editLocked || (sheet.textSizes[key] ?? 12) <= 8}
      aria-label="Уменьшить размер текста" title="Уменьшить текст"
      onClick={() => setSheet(old => ({ ...old, textSizes: { ...old.textSizes, [key]: Math.max(8, (old.textSizes[key] ?? 12) - 1) } }))}>−</button>
  </div>;
  const longField = (label: string, key: string, placeholder = '', extraClass = '') =>
    <section className={'moon-long-field moon-resizable-text ' + extraClass} key={key} style={{ '--moon-editor-text-size': (sheet.textSizes[key] ?? 12) + 'px' } as CSSProperties}>
      <RichField id={'moon-' + key} label={label} value={sheet.fields[key] ?? ''}
        onChange={value => change(key, value)} resourceContext={sheet.fields} placeholder={placeholder} disabled={editLocked} grow />
      {!previewMode && textSizeControls(key)}
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
            <button type="button" disabled={editLocked} onClick={() => adjustResource(id, -1)}
              title="Уменьшить текущее значение" aria-label={'Уменьшить ' + id}>−</button>
            <input type="text" inputMode="numeric" maxLength={8} disabled={editLocked}
              aria-label={'Текущее ' + id} value={sheet.fields[id + 'Current'] ?? ''}
              placeholder="—" onChange={event => change(id + 'Current', event.target.value)} />
            <span>/</span>
            <input type="text" inputMode="numeric" maxLength={8} disabled={editLocked}
              aria-label={'Максимальное ' + id} placeholder="—"
              value={moonDisplayedMax(sheet, id)} onChange={event => changeMax(id, event.target.value)} />
            <button type="button" disabled={editLocked} onClick={() => adjustResource(id, 1)}
              title="Увеличить текущее значение" aria-label={'Увеличить ' + id}>+</button>
            {computed !== null && overridden && <button type="button" disabled={editLocked}
              title="Вернуть автоматический расчёт" aria-label={'Сбросить ручной максимум ' + id}
              onClick={() => resetMax(id)}><RotateCcw size={12} /></button>}
          </div>
        </div>
      </div>;
    })}
  </div>;

  return <main className="page moon-editor" ref={pdfRoot} style={moonLayoutVariables(layoutOverride ?? DEFAULT_MOON_LAYOUT) as CSSProperties}>
    <div className="pf-toolbar moon-toolbar">
      <button type="button" className="text-button" disabled={editLocked} onClick={() => void back()}>
        <ArrowLeft size={17} /> К персонажам
      </button>
      <h1 className="pf-minimal-title moon-toolbar-title">Лист персонажа Pr. Moon</h1>
      <div className="pf-toolbar-right">
        {!previewMode && <AutoSaveStatus phase={auto.phase} error={error} savedAt={auto.savedAt} onRetry={auto.retry}/>}
          {!previewMode && <button type="button" className="sheet-pdf-export-tab" disabled={exportingPdf}
            onClick={()=>void exportPdf()} title="Скачать заполненный лист в PDF"
            aria-label="Экспорт листа Project Moon в PDF">
            <FileDown size={18}/><span>{exportingPdf?'Создаю…':'PDF'}</span>
          </button>}

        <div className="pf-settings-area moon-settings-area">
          <button type="button" className="pf-settings-button" aria-label="Настройки листа"
            aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>
            <Settings2 size={17} /> <span>Настройки</span>
          </button>
          {settingsOpen && <div className="pf-settings-popover moon-settings-popover" role="group"
            aria-label="Настройки Project Moon">
            <label className="pf-settings-option">
              <input type="checkbox" disabled={editLocked} checked={sheet.autoVitals}
                onChange={event => setSheet(old => ({ ...old, autoVitals: event.target.checked }))} />
              Автоматический подсчёт HP / ST / SP
            </label>
            <label className="pf-settings-option">
              <input type="checkbox" disabled={editLocked} checked={sheet.smoothWeaponSwitch}
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

      </div>
    </div>

    {pdfError && <p role="alert" className="form-error">{pdfError}</p>}
    <div className="moon-sheet-scroll" aria-label="Страницы листа Project Moon">
      {visibleMoonPages.map(page => <article key={page} id={'moon-sheet-page-' + page}
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
              <input type="text" disabled={editLocked} maxLength={100} value={name}
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
          <div className="moon-portrait-host">
            <MoonPortrait url={portraitUrl} frame={portraitFrame} name={name}
              onEditPortrait={previewMode ? undefined : onEditPortrait} />
          </div>
        </div>
        <section className="moon-section">
          {sectionTitle(1, 'Характеристики')}
          <div className="moon-attributes">
            {MOON_ATTRIBUTES.map(item =>
              <label className="moon-attribute" key={item.id}>
                <span className="moon-attribute-label">{item.label}<small>{item.english}</small></span>
                <input inputMode="numeric" type="text" maxLength={4} disabled={editLocked}
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
          <div className="moon-inventory-heading">
            {sectionTitle(3, 'Инвентарь')}
            <label className="moon-inventory-columns-control">
              <span>Колонок</span>
              <select aria-label="Количество колонок инвентаря" disabled={editLocked}
                value={sheet.inventoryColumns}
                onChange={event => setSheet(old => ({ ...old, inventoryColumns: Number(event.target.value) }))}>
                {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
          </div>
          {sheet.inventoryColumns < 4 && <p className="moon-inventory-hidden-hint" role="status">
            Содержимое скрытых колонок сохранено. Верните 4 колонки, чтобы снова его увидеть.
          </p>}
          <div className="moon-inventory-grid" style={{ '--moon-inventory-columns': sheet.inventoryColumns } as CSSProperties}>
            {Array.from({ length: sheet.inventoryColumns }, (_, index) => {
              const key = index === 0 ? 'inventory' : 'inventory' + (index + 1);
              return <div className="moon-inventory-column" key={key}>
                {longField('Инвентарь, колонка ' + (index + 1), key,
                  index === 0 ? 'Предметы, снаряжение и заметки…' : '', 'moon-lined')}
              </div>;
            })}
          </div>
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
              <small>По правилам: {moonAttackBonus(sheet) || '+Ранг'}</small>
              <input type="text" value={sheet.fields.attackBonus ?? ''} disabled={editLocked}
                onChange={event=>change('attackBonus',event.target.value)}
                placeholder={moonAttackBonus(sheet) || '+Ранг'} aria-label="Бонус атаки" />
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
                title="Добавить оружие" disabled={editLocked || sheet.weapons.length >= 100}
                onClick={addWeapon}><Plus size={16}/></button>
              <button type="button" className="moon-delete-weapon-mobile"
                aria-label={'Удалить оружие ' + moonWeaponLetter(Math.min(weaponOffset + visibleWeapons - 1, sheet.weapons.length - 1))}
                title={sheet.weapons.length <= 2 ? 'Должно остаться хотя бы два оружия' : 'Удалить выбранное оружие'}
                disabled={editLocked || sheet.weapons.length <= 2}
                onClick={() => deleteWeapon(sheet.weapons[Math.min(weaponOffset + visibleWeapons - 1, sheet.weapons.length - 1)].id)}>
                <X size={16}/>
              </button>
            </div>
          </div>
          <div className="moon-weapon-carousel" ref={weaponViewportRef} aria-label="Карточки оружия">
            <div className="moon-weapon-track">
              {sheet.weapons.map((weapon, index) => <div className="moon-card moon-weapon-card" key={weapon.id}
                inert={index < weaponOffset || index >= weaponOffset + visibleWeapons}>
                <div className="moon-card-heading moon-weapon-heading">
                  <input type="text" className="moon-weapon-title" maxLength={160} disabled={editLocked}
                    aria-label={'Название оружия ' + moonWeaponLetter(index)}
                    value={weapon.name}
                    placeholder={'ОРУЖИЕ ' + moonWeaponLetter(index)}
                    onChange={event => updateWeaponById(weapon.id,{name:event.target.value})}/>
                  <span className="moon-card-meta">
                    <label>РАНГ <input aria-label={'Ранг оружия ' + (index + 1)} disabled={editLocked}
                      value={weapon.rank ?? ''} onChange={e => updateWeaponById(weapon.id,{rank:e.target.value})} /></label>
                    <label>EP <input aria-label={'EP оружия ' + (index + 1)} disabled={editLocked}
                      value={weapon.ep ?? ''} onChange={e => updateWeaponById(weapon.id,{ep:e.target.value})} /></label>
                    {index === weaponOffset + visibleWeapons - 1 && <>
                      <button type="button" className="moon-add-weapon" title="Добавить оружие"
                        aria-label="Добавить оружие" disabled={editLocked || sheet.weapons.length >= 100}
                        onClick={addWeapon}><Plus size={15}/></button>
                      <button type="button" className="moon-delete-weapon"
                        title={sheet.weapons.length <= 2 ? 'Должно остаться хотя бы два оружия' : 'Удалить это оружие'}
                        aria-label={'Удалить оружие ' + moonWeaponLetter(index)}
                        disabled={editLocked || sheet.weapons.length <= 2}
                        onClick={() => deleteWeapon(weapon.id)}><X size={15}/></button>
                    </>}
                  </span>
                </div>
                <div className="moon-choice-row"><span>Тип:</span>
                  {['ближнее','дальнее'].map(value=><label key={value}><input type="radio" disabled={editLocked}
                    name={'moon-weapon-kind-' + weapon.id} checked={(weapon.kind ?? '')===value}
                    onChange={()=>updateWeaponById(weapon.id,{kind:value})}/>{value}</label>)}
                </div>
                <div className="moon-choice-row"><span>Урон:</span>
                  {[{value:'Slash',label:'Режущий'},{value:'Pierce',label:'Колющий'},{value:'Blunt',label:'Дробящий'},{value:'Other',label:'Иной'}]
                    .map(({value,label})=><label key={value}><input type="radio" disabled={editLocked}
                    name={'moon-weapon-damage-' + weapon.id} checked={(weapon.damage ?? '')===value}
                    onChange={()=>updateWeaponById(weapon.id,{damage:value})}/>{label}</label>)}
                </div>
                <div className="moon-weapon-secondary">
                  <label>Кости <input disabled={editLocked} aria-label={'Кости оружия ' + (index + 1)}
                    value={weapon.dice} onChange={e=>updateWeaponById(weapon.id,{dice:e.target.value})} /></label>
                  <label>Форма <input disabled={editLocked} aria-label={'Форма оружия ' + (index + 1)}
                    value={weapon.form ?? ''} onChange={e=>updateWeaponById(weapon.id,{form:e.target.value})} /></label>
                </div>
                <label className="moon-compact-field"><span>Хват / свойства:</span>
                  <input disabled={editLocked} value={weapon.grip ?? ''} onChange={e=>updateWeaponById(weapon.id,{grip:e.target.value})}
                    aria-label={'Хват и свойства оружия ' + (index + 1)} /></label>
                <div className="moon-rich-group"><span>ЭФФЕКТЫ / УСЛОВИЯ</span>
                  <RichField id={'moon-' + weapon.id} label={'Эффекты оружия ' + (index + 1)}
                    value={weapon.description} onChange={value=>updateWeaponById(weapon.id,{description:value})}
                    disabled={editLocked} resourceContext={sheet.fields} grow placeholder="Эффекты и условия…" />
                </div>
                <label className="moon-compact-field moon-bonus-field"><span>Доп. бонус:</span>
                  <input disabled={editLocked} value={weapon.bonus} onChange={e=>updateWeaponById(weapon.id,{bonus:e.target.value})}
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
                  <input disabled={editLocked} aria-label={kind + ' ' + damage}
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
                  {['Name','Stacks','Duration'].map(key=><td key={key}><input disabled={editLocked}
                    aria-label={'Состояние ' + index + ' ' + key}
                    value={sheet.fields['condition' + key + index] ?? ''}
                    onChange={e=>change('condition' + key + index,e.target.value)}/></td>)}
                </tr>)}</tbody>
              </table>
              <div className="moon-conditions-extra"><RichField id="moon-conditions" label="Дополнительные состояния"
                value={sheet.fields.conditions ?? ''} onChange={value=>change('conditions',value)}
                disabled={editLocked} resourceContext={sheet.fields} grow placeholder="Другие состояния…" /></div>
              <p className="moon-mechanics-hint">CR 3.x: ST = 0 — ошеломление (−5 SP, +1 Light); SP = 0 — паника; HP = 0 — кровотечение. Подсказки не изменяют ресурсы и состояния.</p>
            </div>
          </div>
          <div className="moon-damage-calculator">
            <button type="button" className="text-button" aria-expanded={damageCalculatorOpen}
              onClick={()=>setDamageCalculatorOpen(open=>!open)}>
              {damageCalculatorOpen?'Скрыть калькулятор урона':'Калькулятор урона (необязательно)'}
            </button>
            {damageCalculatorOpen && <div className="moon-damage-calculator-content">
              <p>Итог атаки × сопротивление + добавочный урон после сопротивления. Расчёт HP и ST раздельный; списания нет.</p>
              <div className="moon-damage-calculator-controls">
                <label>Итог атаки <input aria-label="Итог атаки для калькулятора" type="text" inputMode="decimal"
                  value={damageRoll} onChange={event=>setDamageRoll(event.target.value)} placeholder="Например, 12"/></label>
                <label>Тип урона <select aria-label="Тип урона для калькулятора" value={damageType}
                  onChange={event=>setDamageType(event.target.value as typeof damageType)}>
                  <option value="slash">Режущий</option><option value="pierce">Колющий</option><option value="blunt">Дробящий</option>
                </select></label>
                <label>Доп. урон HP <input aria-label="Добавочный урон HP" type="text" inputMode="decimal"
                  value={damageAfterHp} onChange={event=>setDamageAfterHp(event.target.value)} placeholder="0"/></label>
                <label>Доп. урон ST <input aria-label="Добавочный урон ST" type="text" inputMode="decimal"
                  value={damageAfterSt} onChange={event=>setDamageAfterSt(event.target.value)} placeholder="0"/></label>
              </div>
              <div className="moon-damage-calculator-results">
                {(['HP','ST'] as const).map(kind=>{
                  const resist=sheet.fields['resistance'+kind+damageType] ?? '';
                  const amount=moonDamageEstimate(damageRoll,resist,kind==='HP'?damageAfterHp:damageAfterSt);
                  return <span key={kind}>{kind}: <strong>{amount===null?'—':amount}</strong>
                    <small> (сопротивление: {resist||'не указано'})</small></span>;
                })}
              </div>
              <small>Без дополнительного округления. Особые эффекты и округление согласуются с ведущим.</small>
            </div>}
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
                    <input disabled={editLocked} aria-label={key + ' приёма ' + (index + 1)}
                      value={skill[key] ?? ''} onChange={e=>updateSkill(skill.id,{[key]:e.target.value})}/></label>)}
                  <button type="button" title="Удалить приём" aria-label={'Удалить приём ' + (index + 1)}
                    disabled={editLocked} onClick={()=>setPendingSkillDelete(skill.id)}><Trash2 size={14}/></button>
                </span>
              </div>
              <label className="moon-compact-field"><strong>Название:</strong>
                <input disabled={editLocked} value={skill.title}
                  onChange={e=>updateSkill(skill.id,{title:e.target.value})}
                  aria-label={'Название приёма ' + (index + 1)}/></label>
              <div className="moon-choice-row"><span>Тип:</span>
                {['атака','блок','уклонение','проверка'].map(value=><label key={value}>
                  <input type="radio" disabled={editLocked} name={'moon-skill-type-' + skill.id}
                    checked={(skill.type ?? '') === value} onChange={()=>updateSkill(skill.id,{type:value})}/>{value}
                </label>)}
              </div>
              <div className="moon-rich-group"><span>УСЛОВИЯ / ЭФФЕКТ:</span>
                <RichField id={'moon-' + skill.id} label={'Приём ' + (index + 1)}
                  value={skill.body} onChange={value=>updateSkill(skill.id,{body:value})}
                  disabled={editLocked} resourceContext={sheet.fields} grow placeholder="Условия, эффекты и описание…" />
              </div>
            </div>)}
          </div>
          <button type="button" className="moon-add" disabled={editLocked || sheet.skills.length >= 100}
            title={sheet.skills.length >= 100 ? 'Технический предел сохранения — 100 приёмов' : 'Добавить приём'}
            onClick={() => setSheet(old => old.skills.length >= 100 ? old : addMoonSkill(old, 'skill-' + crypto.randomUUID()))}>
            <Plus size={16} /> Добавить приём
          </button>
        </section>
      </>}

      {page === 'equipment' && <MoonEquipmentPage sheet={sheet} setSheet={setSheet} disabled={editLocked}/>}

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
        {sheet.notes.map((note, index) => <section className="moon-card moon-note moon-resizable-text" key={note.id}
          style={{ '--moon-editor-text-size': (sheet.textSizes['note:' + note.id] ?? 12) + 'px' } as CSSProperties}>
          <div className="moon-note-heading">
            <input type="text" disabled={editLocked} maxLength={120}
              aria-label={'Заголовок заметки ' + (index + 1)} value={note.title}
              onChange={event => updateNote(index, { title: event.target.value })}
              placeholder={'ЗАМЕТКИ ' + String(index + 1).padStart(2,'0')} />
          </div>
          <RichField id={'moon-' + note.id} label={'Заметка ' + (index + 1)}
            value={note.body} onChange={value => updateNote(index, { body: value })}
            disabled={editLocked} resourceContext={sheet.fields} grow placeholder="Текст заметки…" />
          {!previewMode && textSizeControls('note:' + note.id)}
        </section>)}
      </div>}
      </article>)}
    </div>
    {pendingWeaponDelete && pendingWeaponIndex >= 0 && <MoonWeaponDeleteDialog
      label={'оружие ' + moonWeaponLetter(pendingWeaponIndex)}
      disabled={editLocked} onCancel={() => setPendingWeaponDelete(null)}
      onConfirm={confirmWeaponDeletion} />}
    {pendingSkillDelete && pendingSkillIndex >= 0 && <MoonWeaponDeleteDialog
      kind="skill" label={'приём ' + (pendingSkillIndex + 1)}
      disabled={editLocked} onCancel={() => setPendingSkillDelete(null)}
      onConfirm={confirmSkillDeletion} />}
    {pageSettingsOpen && <MoonPageSettingsDialog
      order={pageOrder} hiddenPages={sheet.hiddenPages} onPageVisibility={changePageVisibility}
      disabled={editLocked} onOrderChange={changePageOrder}
      onClose={() => setPageSettingsOpen(false)} />}
    {!previewMode && <DiceRollPanel/>}
    {!previewMode && navigationHelp && <FloatingPageNavigation system="prmoon"
      pages={visibleMoonPages.map(page=>({id:page,label:MOON_PAGES.find(entry=>entry.id===page)?.title??page}))}
      activePage={activePage} onNavigate={navigatePage}
      onClose={()=>setNavigationHelp(false)}/>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </main>;
}

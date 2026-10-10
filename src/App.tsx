import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  FilePenLine,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Trash2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import {
  GAME_SYSTEMS,
  defaultDetails,
  detailString,
  normalizeDetails,
  normalizedName,
  systemKeys,
} from './lib/models';
import type { Character, CharacterDetails, GameSystem } from './lib/models';
import { getReturnUrl, isConfigured, supabase } from './lib/supabase';

type Filter = GameSystem | 'all';
type CreatePanel = GameSystem | null;

function messageFromError(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String(error.message);
    if (message.includes("Could not find the table 'public.characters'")) {
      return 'Таблица персонажей не создана. Запусти supabase/schema.sql в SQL Editor.';
    }
    return message;
  }
  return 'Неизвестная ошибка. Попробуй ещё раз.';
}

function SiteLogo() {
  return (
    <span className="brand-wrap" aria-label="At your service!">
      <span className="brand-symbol" aria-hidden="true">a<span className="brand-symbol-mark">.</span></span>
      <img className="brand-wordmark" src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="At your service!" />
    </span>
  );
}

/** Decorative silhouette from the approved homepage mockup. */
function HeroEmblem() {
  return (
    <svg className="hero-emblem" viewBox="0 0 324 118" aria-hidden="true" focusable="false">
      <path d="M162 2 181 14H143Z" />
      <path d="M105 18h114c16 0 29 13 29 29v47H76V47c0-16 13-29 29-29Z" />
      <path d="M65 80h194c9 0 16 7 16 16v2H49v-2c0-9 7-16 16-16Z" />
      <path d="M0 100h324l-28 17H28Z" />
    </svg>
  );
}

const WRECKTRACK_URL = 'https://f-gav.github.io/WreckTrack/';

const badgeLabels: Record<GameSystem, string> = {
  dnd5e: 'DnD',
  pf2e: 'PF2e',
  vtm5e: 'VtM',
};

function characterSubtitle(character: Character): string {
  const race = detailString(character.details, 'race').trim();
  const className = detailString(character.details, 'class').trim();
  if (race || className) return [race, className].filter(Boolean).join(' · ');
  return detailString(character.details, 'concept').trim() || 'Раса · Класс';
}

function EmptySetup() {
  return (
    <div className="setup-notice" role="status">
      <span className="setup-notice-icon"><ShieldCheck size={19} /></span>
      <span><strong>Подключение аккаунтов ещё не настроено.</strong><br />
        Главная страница работает. Для входа и облачного сохранения необходимо добавить параметры Supabase в GitHub Actions Variables и включить Google OAuth. Инструкция — в <code>docs/SETUP-RU.md</code>.
      </span>
    </div>
  );
}

function CharacterEditor({
  character,
  onSave,
  onClose,
}: {
  character: Character;
  onSave: (id: string, name: string, details: CharacterDetails) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [concept, setConcept] = useState(detailString(character.details, 'concept'));
  const [chronicle, setChronicle] = useState(detailString(character.details, 'chronicle'));
  const [notes, setNotes] = useState(detailString(character.details, 'notes'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState({
    name: character.name,
    concept: detailString(character.details, 'concept'),
    chronicle: detailString(character.details, 'chronicle'),
    notes: detailString(character.details, 'notes'),
  });

  const dirty = name !== lastSaved.name || concept !== lastSaved.concept ||
    chronicle !== lastSaved.chronicle || notes !== lastSaved.notes;
  const system = GAME_SYSTEMS[character.system];

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(): Promise<boolean> {
    const cleanName = normalizedName(name);
    if (!cleanName) {
      setError('Укажи имя персонажа.');
      return false;
    }
    setSaving(true);
    setError('');
    const details: CharacterDetails = {
      ...character.details,
      concept: concept.slice(0, 500),
      chronicle: chronicle.slice(0, 200),
      notes: notes.slice(0, 20000),
    };
    try {
      const success = await onSave(character.id, cleanName, details);
      if (!success) {
        setError('Не получилось сохранить изменения. Проверь подключение и повтори попытку.');
        return false;
      }
      setName(cleanName);
      setLastSaved({ name: cleanName, concept, chronicle, notes });
      return true;
    } catch (err) {
      setError(messageFromError(err));
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

  return (
    <main className="page page-editor">
      <div className="editor-nav">
        <button className="text-button" type="button" onClick={() => void goBack()} disabled={saving}>
          <ArrowLeft size={17} /> К персонажам
        </button>
        <div className="editor-actions">
          <span className={`save-status ${dirty ? 'status-changed' : ''}`} aria-live="polite">
            {saving ? 'Сохранение…' : dirty ? 'Есть изменения' : 'Сохранено в аккаунте'}
          </span>
          <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
            <Cloud size={16} /> {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
      <div className="sheet-heading">
        <div className="eyebrow"><span className="small-dot" /> {system.title.toUpperCase()} · {system.edition.toUpperCase()}</div>
        <h1>Лист персонажа<span className="punctuation">.</span></h1>
        <p>Черновик до появления игровых макетов. Данные сохраняются в твоём аккаунте, а структура может расширяться.</p>
      </div>

      <section className="paper" aria-label="Черновик листа персонажа">
        <div className="paper-topline"><span>AT YOUR SERVICE</span><span>{system.short.toUpperCase()} / CHARACTER SHEET</span></div>
        <div className="paper-row paper-row-major">
          <label className="field-label field-name">ИМЯ ПЕРСОНАЖА
            <input disabled={saving} maxLength={100} value={name} onChange={e => { setName(e.target.value); }} placeholder="Например, Авантюрист" autoComplete="off" />
          </label>
          <span className="sheet-placeholder-emblem" aria-hidden="true">{system.short}</span>
        </div>
        <div className="paper-grid">
          <label className="field-label">КОНЦЕПЦИЯ / ОПИСАНИЕ
            <input disabled={saving} maxLength={500} value={concept} onChange={e => { setConcept(e.target.value); }} placeholder="Кто этот персонаж?" />
          </label>
          <label className="field-label">КАМПАНИЯ / ХРОНИКА
            <input disabled={saving} maxLength={200} value={chronicle} onChange={e => { setChronicle(e.target.value); }} placeholder="Название истории" />
          </label>
        </div>
        <div className="divider-line" />
        <label className="field-label field-notes">ЗАМЕТКИ ПЕРСОНАЖА
          <textarea disabled={saving} rows={9} maxLength={20000} value={notes} onChange={e => { setNotes(e.target.value); }} placeholder="История, способности, предметы, планы…" />
        </label>
        <div className="paper-footer"><span>ПОЛНЫЙ ЛИСТ ПОЯВИТСЯ ПОСЛЕ УТВЕРЖДЕНИЯ МАКЕТА</span><FilePenLine size={18} /></div>
      </section>
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="editor-hint"><ShieldCheck size={15} /> Можно редактировать свободно. При выходе через «К персонажам» несохранённые изменения будут сохранены автоматически.</p>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createPanel, setCreatePanel] = useState<CreatePanel>(null);
  const [showSystemPicker, setShowSystemPicker] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  const user = session?.user;
  const active = useMemo(() => characters.find(c => c.id === activeId) ?? null, [characters, activeId]);
  const filteredCharacters = useMemo(() => characters.filter(c => filter === 'all' || c.system === filter), [characters, filter]);

  useEffect(() => {
    if (!openMenuId) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.character-menu-area')) {
        setOpenMenuId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!showSystemPicker && !createPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setShowSystemPicker(false);
        setCreatePanel(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showSystemPicker, createPanel, busy]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const client = supabase;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthReady(true);
    });
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError) setError(messageFromError(authError));
      setSession(data.session);
      setAuthReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!supabase || !userId) {
      setCharacters([]);
      setActiveId(null);
      setLoadingCharacters(false);
      return;
    }
    let cancelled = false;
    setLoadingCharacters(true);
    setCharacters([]);
    const client = supabase;
    void client.from('characters')
      .select('id, user_id, system, name, details, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setLoadingCharacters(false);
        if (loadError) setError(messageFromError(loadError));
        else setCharacters((data ?? []).map(row => ({ ...row, details: normalizeDetails(row.details) })) as Character[]);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function signIn() {
    if (!supabase) {
      setError('Сначала подключи Supabase по инструкции из docs/SETUP-RU.md.');
      return;
    }
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getReturnUrl() },
    });
    if (signInError) setError(messageFromError(signInError));
  }

  async function signOut() {
    if (!supabase) return;
    if (activeId && !window.confirm('Перед выходом убедись, что изменения листа сохранены. Выйти из аккаунта?')) return;
    setError('');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(messageFromError(signOutError));
    else {
      setActiveId(null);
      setCreatePanel(null);
      setShowSystemPicker(false);
      setCharacters([]);
    }
  }

  function openCreate() {
    if (!user) {
      void signIn();
      return;
    }
    setActiveId(null);
    setCreatePanel(null);
    setShowSystemPicker(true);
    setOpenMenuId(null);
    setError('');
  }

  function closeCreate() {
    if (busy) return;
    setShowSystemPicker(false);
    setCreatePanel(null);
    setNewName('');
  }

  function beginCreate(system: GameSystem) {
    if (!user) {
      void signIn();
      return;
    }
    setShowSystemPicker(false);
    setCreatePanel(system);
    setNewName('');
    setError('');
  }

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !createPanel || busy) return;
    const name = normalizedName(newName);
    if (!name) { setError('Укажи имя персонажа.'); return; }
    setBusy(true);
    setError('');
    const { data, error: insertError } = await supabase.from('characters')
      .insert({ user_id: user.id, system: createPanel, name, details: defaultDetails() })
      .select('id, user_id, system, name, details, created_at, updated_at').single();
    setBusy(false);
    if (insertError) { setError(messageFromError(insertError)); return; }
    if (!data) return;
    const created = { ...data, details: normalizeDetails(data.details) } as Character;
    setCharacters(current => [created, ...current]);
    setCreatePanel(null);
    setShowSystemPicker(false);
    setActiveId(created.id);
  }

  async function saveCharacter(id: string, name: string, details: CharacterDetails): Promise<boolean> {
    if (!supabase || !user) return false;
    const { data, error: saveError } = await supabase.from('characters')
      .update({ name, details })
      .eq('id', id).eq('user_id', user.id)
      .select('id, user_id, system, name, details, created_at, updated_at').single();
    if (saveError || !data) {
      setError(messageFromError(saveError));
      return false;
    }
    setError('');
    setCharacters(current => current.map(c => c.id === id ? { ...data, details: normalizeDetails(data.details) } as Character : c));
    return true;
  }

  async function deleteCharacter(character: Character) {
    if (!supabase || !user || busy) return;
    if (!window.confirm(`Удалить персонажа «${character.name}»? Это действие нельзя отменить.`)) return;
    setBusy(true);
    setError('');
    const { error: deleteError } = await supabase.from('characters').delete()
      .eq('id', character.id).eq('user_id', user.id);
    setBusy(false);
    if (deleteError) { setError(messageFromError(deleteError)); return; }
    setCharacters(current => current.filter(c => c.id !== character.id));
  }

  const displayName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name : user?.email?.split('@')[0] ?? 'Игрок';
  const avatar = typeof user?.user_metadata?.avatar_url === 'string' &&
    user.user_metadata.avatar_url.startsWith('https://') ? user.user_metadata.avatar_url : null;

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="brand-button" onClick={() => { if (!activeId) { closeCreate(); setFilter('all'); } }} aria-label="На главную">
            <SiteLogo />
          </button>
          <div className="header-links">
            <a href={WRECKTRACK_URL} target="_blank" rel="noreferrer" className="header-project-link">WreckTrack <ArrowRight size={13} /></a>
            {!authReady ? <span className="muted">Подключение…</span> : user ? (
              <div className="account-actions">
                <span className="account-identity" aria-label={`Аккаунт: ${displayName}`} title={displayName}>
                  {avatar ? <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
                </span>
                <button className="icon-button" type="button" title="Выйти из аккаунта" aria-label="Выйти из аккаунта" onClick={() => void signOut()}><LogOut size={17} /></button>
              </div>
            ) : <button className="button button-header" type="button" onClick={() => void signIn()}><LogIn size={16} /> Войти через Google</button>}
          </div>
          <button type="button" className="mobile-menu-button" aria-label="Меню" aria-expanded={mobileMenu} onClick={() => setMobileMenu(open => !open)}>{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {mobileMenu && <div className="mobile-menu-panel">
          {user ? <><span className="mobile-account-identity" aria-label={`Аккаунт: ${displayName}`} title={displayName}>
            {avatar ? <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
          </span><button type="button" onClick={() => {setMobileMenu(false); void signOut();}}>Выйти из аккаунта</button></>
            : <button type="button" onClick={() => {setMobileMenu(false); void signIn();}}>Войти через Google</button>}
          <a href={WRECKTRACK_URL} target="_blank" rel="noreferrer">WreckTrack ↗</a>
        </div>}
      </header>

      {active ? (
        <CharacterEditor key={active.id} character={active} onSave={saveCharacter} onClose={() => { setActiveId(null); setFilter('all'); }} />
      ) : (
        <main className="page page-home">
          <section className="hero" aria-labelledby="main-title">
            <div className="hero-copy">
              <h1 id="main-title"><img src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="At your service!" /></h1>
              <p>Храни свою историю, чтобы она не превратилась в Осколки!</p>
            </div>
            <HeroEmblem />
          </section>

          {!isConfigured && <EmptySetup />}
          {error && <div className="global-error" role="alert"><span>{error}</span><button aria-label="Закрыть ошибку" type="button" onClick={() => setError('')}><X size={16} /></button></div>}

          <section className="library-section" aria-labelledby="library-title">
            <div className="library-heading">
              <h2 id="library-title">Мои персонажи: ({characters.length})</h2>
              <div className="system-filters" role="group" aria-label="Фильтр персонажей по системе">
                {systemKeys.map((system, index) => (
                  <span className="filter-item" key={system}>
                    {index > 0 && <span className="filter-separator" aria-hidden="true">·</span>}
                    <button type="button" aria-pressed={filter === system} className={filter === system ? 'system-filter is-active' : 'system-filter'} onClick={() => setFilter(current => current === system ? 'all' : system)}>{system === 'dnd5e' ? 'D&D' : system === 'pf2e' ? 'PATHFINDER' : 'VAMPIRE'}</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="character-grid">
              {loadingCharacters ? (
                <div className="library-state" role="status">Загружаем персонажей…</div>
              ) : filteredCharacters.map(character => (
                <article className={`character-card character-${character.system}`} key={character.id} aria-label={`Персонаж ${character.name}`}>
                  <button type="button" className="character-open" onClick={() => { setActiveId(character.id); setOpenMenuId(null); setError(''); }} aria-label={`Открыть лист персонажа ${character.name}`}>
                    <span className="character-portrait" aria-hidden="true" />
                    <span className="character-data">
                      <strong>{character.name}</strong>
                      <span>{characterSubtitle(character)}</span>
                    </span>
                  </button>
                  <span className="character-system" aria-label={GAME_SYSTEMS[character.system].title}>{badgeLabels[character.system]}</span>
                  <div className="character-menu-area">
                    <button type="button" className="character-menu-button" title={`Действия с персонажем ${character.name}`} aria-label={`Действия с персонажем ${character.name}`} aria-expanded={openMenuId === character.id} onClick={() => setOpenMenuId(current => current === character.id ? null : character.id)}>
                      <MoreHorizontal size={25} strokeWidth={3} />
                    </button>
                    {openMenuId === character.id && <div className="character-menu" role="group" aria-label={`Действия: ${character.name}`}>
                      <button type="button" onClick={() => { setActiveId(character.id); setOpenMenuId(null); setError(''); }}><FilePenLine size={15} /> Открыть лист</button>
                      <button type="button" className="menu-delete" disabled={busy} onClick={() => { setOpenMenuId(null); void deleteCharacter(character); }}><Trash2 size={15} /> Удалить</button>
                    </div>}
                  </div>
                </article>
              ))}
              <button type="button" className="add-character" onClick={openCreate} disabled={loadingCharacters} aria-label="Создать персонажа"><Plus size={33} strokeWidth={2.2} /></button>
              {!loadingCharacters && filteredCharacters.length === 0 && filter !== 'all' && <div className="library-state">В этой системе пока нет персонажей. <button type="button" onClick={() => setFilter('all')}>Показать всех</button></div>}
            </div>
            {!user && authReady && <p className="library-help">Войди через Google, чтобы создавать персонажей и хранить их в своём аккаунте.</p>}
          </section>

          {(showSystemPicker || createPanel) && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeCreate(); }}>
            <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
              <div className="modal-top"><span>НОВЫЙ ПЕРСОНАЖ</span><button type="button" className="modal-close" onClick={closeCreate} disabled={busy} aria-label="Закрыть"><X size={21} /></button></div>
              {showSystemPicker ? <>
                <h2 id="create-title">Выбери игровую систему</h2>
                <p>Для какой истории создаём персонажа?</p>
                <div className="create-system-list">
                  {systemKeys.map(system => <button type="button" autoFocus={system === 'dnd5e'} key={system} onClick={() => beginCreate(system)}>
                    <span><strong>{GAME_SYSTEMS[system].title}</strong><small>{GAME_SYSTEMS[system].subtitle}</small></span><ArrowRight size={18} />
                  </button>)}
                </div>
              </> : createPanel && <>
                <button type="button" className="text-button modal-back" onClick={() => { setCreatePanel(null); setShowSystemPicker(true); }} disabled={busy}><ArrowLeft size={16} /> К выбору системы</button>
                <h2 id="create-title">{GAME_SYSTEMS[createPanel].title}</h2>
                <p>Начни с имени. Остальное заполнишь в листе персонажа.</p>
                <form className="create-form" onSubmit={event => void createCharacter(event)}>
                  <label className="form-label">Имя персонажа
                    <input autoFocus required maxLength={100} placeholder="Как зовут твоего героя?" value={newName} onChange={event => setNewName(event.target.value)} />
                  </label>
                  <button disabled={busy || !normalizedName(newName)} type="submit" className="button button-primary"><Plus size={17} /> {busy ? 'Создаю…' : 'Создать лист'}</button>
                </form>
              </>}
            </section>
          </div>}
        </main>
      )}

      <footer className="site-footer"><span>AT YOUR SERVICE <span className="footer-alpha">/ ВЕРСИЯ #1</span></span><span>Создано для историй, которые стоит помнить. <Check size={13} /></span></footer>
    </div>
  );
}

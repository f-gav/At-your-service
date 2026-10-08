import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  FilePenLine,
  FolderOpen,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
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
    <span className="brand-wrap" aria-label="At your service">
      <span className="brand-symbol" aria-hidden="true">a<span className="brand-symbol-mark">.</span></span>
      <span className="brand-name">At your service</span>
    </span>
  );
}

function SystemCard({
  system,
  onClick,
  count,
}: {
  system: GameSystem;
  onClick: (system: GameSystem) => void;
  count: number | null;
}) {
  const entry = GAME_SYSTEMS[system];
  return (
    <button type="button" className={`system-card system-${system}`} onClick={() => onClick(system)}>
      <span className="system-card-top"><span className="card-index">{entry.code} / SYSTEM</span><ArrowRight size={19} /></span>
      <span className="system-glyph" aria-hidden="true">{entry.short}</span>
      <span className="system-card-bottom">
        <span><span className="system-title">{entry.title}</span><span className="system-subtitle">{entry.subtitle}</span></span>
        {count !== null && <span className="system-count">{count} {count === 1 ? 'лист' : 'листов'}</span>}
      </span>
    </button>
  );
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
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  const user = session?.user;
  const active = useMemo(() => characters.find(c => c.id === activeId) ?? null, [characters, activeId]);
  const filteredCharacters = useMemo(() => characters.filter(c => filter === 'all' || c.system === filter), [characters, filter]);
  const counts = useMemo(() => Object.fromEntries(systemKeys.map(k => [k, characters.filter(c => c.system === k).length])) as Record<GameSystem, number>, [characters]);

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
      setCharacters([]);
    }
  }

  function beginCreate(system: GameSystem) {
    if (!user) {
      void signIn();
      return;
    }
    setActiveId(null);
    setCreatePanel(system);
    setNewName('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <button type="button" className="brand-button" onClick={() => { if (!activeId) { setCreatePanel(null); setFilter('all'); } }} aria-label="На главную">
            <SiteLogo />
          </button>
          <div className="header-links">
            <a href="https://github.com/f-gav/WreckTrack" target="_blank" rel="noreferrer" className="header-project-link">WreckTrack <ArrowRight size={13} /></a>
            {!authReady ? <span className="muted">Подключение…</span> : user ? (
              <div className="account-actions">
                <span className="account-identity">
                  {avatar ? <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-initial">{displayName.charAt(0).toUpperCase()}</span>}
                  <span className="account-name">{displayName}</span>
                </span>
                <button className="icon-button" type="button" title="Выйти из аккаунта" aria-label="Выйти из аккаунта" onClick={() => void signOut()}><LogOut size={17} /></button>
              </div>
            ) : <button className="button button-header" type="button" onClick={() => void signIn()}><LogIn size={16} /> Войти через Google</button>}
          </div>
          <button type="button" className="mobile-menu-button" aria-label="Меню" aria-expanded={mobileMenu} onClick={() => setMobileMenu(open => !open)}>{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {mobileMenu && <div className="mobile-menu-panel">
          {user ? <><span className="muted">{displayName}</span><button type="button" onClick={() => {setMobileMenu(false); void signOut();}}>Выйти из аккаунта</button></>
            : <button type="button" onClick={() => {setMobileMenu(false); void signIn();}}>Войти через Google</button>}
          <a href="https://github.com/f-gav/WreckTrack" target="_blank" rel="noreferrer">WreckTrack ↗</a>
        </div>}
      </header>

      {active ? (
        <CharacterEditor key={active.id} character={active} onSave={saveCharacter} onClose={() => { setActiveId(null); setFilter('all'); }} />
      ) : (
        <main className="page">
          <section className="hero" aria-labelledby="main-title">
            <div className="eyebrow"><span className="small-dot" /> ЦИФРОВЫЕ ЛИСТЫ ПЕРСОНАЖЕЙ</div>
            <h1 id="main-title">At your<br />service</h1>
            <div className="hero-footer"><p>У каждого героя — своя история.<br />Храни её там, где удобно.</p><span className="hero-aside">D&D <span>·</span> PATHFINDER <span>·</span> VAMPIRE</span></div>
          </section>

          {!isConfigured && <EmptySetup />}
          {error && <div className="global-error" role="alert"><span>{error}</span><button aria-label="Закрыть ошибку" type="button" onClick={() => setError('')}><X size={16} /></button></div>}

          {createPanel ? (
            <section className="create-section">
              <div className="section-top"><span className="overline">НОВЫЙ ПЕРСОНАЖ</span><button className="text-button" type="button" onClick={() => setCreatePanel(null)}><X size={16} /> Отмена</button></div>
              <form className="create-form" onSubmit={event => void createCharacter(event)}>
                <div><h2>{GAME_SYSTEMS[createPanel].title}</h2><p>Начни с имени. Остальные данные заполнишь в листе.</p></div>
                <label className="form-label">Имя персонажа
                  <input autoFocus required maxLength={100} placeholder="Как зовут твоего героя?" value={newName} onChange={e => setNewName(e.target.value)} />
                </label>
                <button disabled={busy || !normalizedName(newName)} type="submit" className="button button-primary"><Plus size={17} /> {busy ? 'Создаю…' : 'Создать лист'}</button>
              </form>
            </section>
          ) : (
            <section className="systems-section" aria-labelledby="systems-title">
              <div className="section-top"><h2 className="section-label" id="systems-title">Выбери игровую систему</h2><span className="overline">01—03</span></div>
              <div className="systems-grid">
                {systemKeys.map(system => <SystemCard key={system} system={system} onClick={beginCreate} count={user ? counts[system] : null} />)}
              </div>
            </section>
          )}

          {user && !createPanel && <section className="library-section" aria-labelledby="library-title">
            <div className="section-top"><div><span className="overline">ЛИЧНАЯ БИБЛИОТЕКА</span><h2 id="library-title">Твои персонажи<span className="punctuation">.</span></h2></div><span className="library-amount">{characters.length} всего</span></div>
            <div className="filter-bar" role="group" aria-label="Фильтр листов">
              {(['all', ...systemKeys] as Filter[]).map(item => <button key={item} className={filter === item ? 'filter active' : 'filter'} type="button" onClick={() => setFilter(item)}>{item === 'all' ? 'Все' : GAME_SYSTEMS[item].short}</button>)}
            </div>
            {loadingCharacters ? <div className="library-empty"><FolderOpen size={23} /><span>Загружаем персонажей…</span></div> : filteredCharacters.length ? (
              <div className="character-list">
                {filteredCharacters.map(character => (
                  <div className="character-row" key={character.id}>
                    <button type="button" className="character-row-main" onClick={() => {setActiveId(character.id); setError('');}}>
                      <span className="character-monogram">{character.name.charAt(0).toUpperCase()}</span>
                      <span className="character-data"><strong>{character.name}</strong><span>{GAME_SYSTEMS[character.system].title} · {detailString(character.details,'concept') || 'Без описания'}</span></span>
                      <ChevronRight size={19} className="character-chevron" />
                    </button>
                    <button className="delete-button" type="button" disabled={busy} title={`Удалить ${character.name}`} aria-label={`Удалить ${character.name}`} onClick={() => void deleteCharacter(character)}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
            ) : <div className="library-empty"><BookOpen size={23} /><span>{filter === 'all' ? 'Пока ни одного персонажа. Создай первый лист выше.' : 'В этой системе пока нет персонажей.'}</span></div>}
          </section>}

          {!user && <section className="benefits-section">
            <div className="benefit"><Cloud size={19} /><span>Сохранение в облаке</span></div>
            <div className="benefit"><ShieldCheck size={19} /><span>Личные листы и приватность</span></div>
            <div className="benefit"><Sparkles size={19} /><span>Свобода заполнения</span></div>
          </section>}
        </main>
      )}

      <footer className="site-footer"><span>AT YOUR SERVICE <span className="footer-alpha">/ EARLY ALPHA</span></span><span>Создано для историй, которые стоит помнить. <Check size={13} /></span></footer>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Save, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Character } from '../../lib/models';
import ProjectMoonSheet from './ProjectMoonSheet';
import { emptyMoonSheet } from './model';
import {
  DEFAULT_MOON_LAYOUT, MOON_LAYOUT_CONTROLS, MOON_LAYOUT_KEY,
  parseMoonLayout, encodeMoonLayout, isMoonPortraitShift,
} from './layout-settings';
import type { MoonLayout, MoonLayoutKey } from './layout-settings';
import './MoonLayoutAdmin.css';

const previewCharacter: Character = {
  id: 'local-project-moon-preview', user_id: 'local-admin-preview', system: 'prmoon',
  name: 'Пример персонажа',
  details: { projectMoonSheet: {
    ...emptyMoonSheet(),
    fields: { rank: '1', level: '1', occupation: 'Фиксер', organization: 'Ассоциация',
      fortitude: '2', prudence: '2', determination: '2', charm: '2', discernment: '2',
      temperance: '2' },
  } },
  created_at: '', updated_at: '', sort_order: 0,
  portrait_card_path: null, portrait_sheet_path: null,
  portrait_source_path: null, portrait_crops: null,
};

type Props = { userId: string; onClose: () => void };
export default function MoonLayoutAdmin({userId,onClose}: Props) {
  const [layout, setLayout] = useState<MoonLayout>(DEFAULT_MOON_LAYOUT);
  const [saved, setSaved] = useState(JSON.stringify(DEFAULT_MOON_LAYOUT));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [versions, setVersions] = useState<number[]>([]);
  const [restore, setRestore] = useState('');
  const dirty = saved !== JSON.stringify(layout);

  useEffect(() => {
    if (!supabase) { setMessage('Supabase недоступен'); setLoading(false); return; }
    let mounted = true;
    void Promise.all([
      supabase.from('sheet_template_drafts').select('fields').eq('template_key', MOON_LAYOUT_KEY).maybeSingle(),
      supabase.from('sheet_templates').select('fields,version').eq('template_key', MOON_LAYOUT_KEY).maybeSingle(),
      supabase.from('sheet_template_history').select('version').eq('template_key', MOON_LAYOUT_KEY)
        .order('version',{ ascending: false }).limit(30),
    ]).then(([draft,published,history]) => {
      if (!mounted) return;
      setLoading(false);
      const error = draft.error || published.error || history.error;
      if (error) { setMessage('Ошибка загрузки: ' + error.message); return; }
      const next = parseMoonLayout(draft.data?.fields ?? published.data?.fields);
      setLayout(next); setSaved(JSON.stringify(next));
      setVersion(published.data?.version ?? 0);
      setVersions((history.data ?? []).map(entry => entry.version));
      setMessage(draft.data?.fields ? 'Загружен черновик.' : 'Загружена опубликованная разметка.');
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(key: MoonLayoutKey, raw: string) {
    const control = MOON_LAYOUT_CONTROLS.find(item => item.key === key);
    if (!control) return;
    if (control.min === undefined) {
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) setLayout(old => ({ ...old, [key]: raw }));
      return;
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    const bounded = isMoonPortraitShift(key) ? number
      : Math.min(control.max!, Math.max(control.min!, number));
    setLayout(old => ({ ...old, [key]: Math.round(bounded) }));
  }

  async function saveDraft(): Promise<boolean> {
    if (!supabase || busy || loading) return false;
    setBusy(true); setMessage('');
    try {
      const {error} = await supabase.from('sheet_template_drafts').upsert({
        template_key: MOON_LAYOUT_KEY, fields: encodeMoonLayout(layout),
        updated_by: userId, updated_at: new Date().toISOString(),
      }, { onConflict: 'template_key' });
      if (error) { setMessage('Ошибка сохранения: ' + error.message); return false; }
      setSaved(JSON.stringify(layout));
      setMessage('Черновик сохранён. На сайте всё ещё опубликована предыдущая версия.');
      return true;
    } finally { setBusy(false); }
  }
  async function publish() {
    if (!supabase || busy || !confirm('Опубликовать оформление Pr. Moon для всех пользователей?')) return;
    if (!(await saveDraft())) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.rpc('publish_sheet_template',{ p_template_key: MOON_LAYOUT_KEY });
      if (error) { setMessage('Не удалось опубликовать: ' + error.message); return; }
      const next = Number(data);
      setVersion(next); setVersions(old => [next,...old]);
      setMessage('Версия ' + next + ' опубликована. Оформление появится у пользователей после обновления листа.');
    } finally { setBusy(false); }
  }
  async function restoreVersion() {
    if (!supabase || !restore || busy) return;
    if (!confirm('Загрузить выбранную версию в редактор?')) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.from('sheet_template_history').select('fields')
        .eq('template_key',MOON_LAYOUT_KEY).eq('version', Number(restore)).single();
      if (error) { setMessage('Ошибка загрузки версии: ' + error.message); return; }
      setLayout(parseMoonLayout(data?.fields));
      setMessage('Версия восстановлена в редакторе. Для применения сначала сохрани черновик.');
    } finally { setBusy(false); }
  }
  function exit() {
    if (dirty && !confirm('Выйти без сохранения изменений оформления?')) return;
    onClose();
  }

  return <main className="page moon-admin">
    <header className="moon-admin-toolbar">
      <button type="button" onClick={exit}><ArrowLeft size={17}/> К выбору листа</button>
      <h1>Редактор оформления Pr. Moon</h1>
      <div className="moon-admin-actions">
        <button type="button" disabled={busy || loading || !dirty} onClick={() => void saveDraft()}>
          <Save size={16}/> Сохранить черновик
        </button>
        <button type="button" className="moon-admin-publish" disabled={busy || loading} onClick={() => void publish()}>
          <UploadCloud size={16}/> Опубликовать
        </button>
      </div>
    </header>
    <p className="moon-admin-status" role="status">{loading ? 'Загрузка…' : message}{dirty ? ' · Не сохранено' : ''}</p>
    <div className="moon-admin-columns">
      <div className="moon-admin-preview">
        <ProjectMoonSheet key="moon-admin-preview" character={previewCharacter} previewMode
          layoutOverride={layout} onSave={async () => true} onClose={() => {}} onEditPortrait={() => {}} />
      </div>
      <aside className="moon-admin-inspector">
        <h2>Оформление HTML-листа</h2>
        <p>Изменяй параметры и смотри результат на всех четырёх страницах. Поля персонажей и их значения не затрагиваются.</p>
        <div className="moon-admin-controls">
          {MOON_LAYOUT_CONTROLS.map(option =>
            <label key={option.key}>{option.title}
              {option.min === undefined
                ? <input type="color" disabled={busy || loading}
                    value={layout[option.key] as string}
                    onChange={e => change(option.key,e.target.value)}/>
                : <span className="moon-admin-value">
                    <input type="range"
                      min={isMoonPortraitShift(option.key)
                        ? Math.min(option.min!, (layout[option.key] as number) - 100) : option.min}
                      max={isMoonPortraitShift(option.key)
                        ? Math.max(option.max!, (layout[option.key] as number) + 100) : option.max}
                      step={option.step || 1} disabled={busy || loading}
                      value={layout[option.key] as number}
                      onChange={e => change(option.key,e.target.value)}/>
                    <input type="number" min={isMoonPortraitShift(option.key) ? undefined : option.min}
                      max={isMoonPortraitShift(option.key) ? undefined : option.max}
                      step={option.step || 1}
                      aria-label={option.title} disabled={busy || loading} value={layout[option.key] as number}
                      onChange={e => change(option.key,e.target.value)}/>
                    <small>{option.unit}</small>
                  </span>}
            </label>)}
        </div>
        <button type="button" className="moon-admin-reset" disabled={busy || loading}
          onClick={() => {if (confirm('Вернуть исходные размеры и цвета листа?')) setLayout({...DEFAULT_MOON_LAYOUT});}}>
          <RotateCcw size={15}/> Исходное оформление
        </button>
        <hr/>
        <h3>История оформления</h3>
        <p>Опубликованная версия: {version || 'нет'}. Черновик виден только администратору.</p>
        <label>Загрузить версию
          <select value={restore} disabled={busy || loading} onChange={e => setRestore(e.target.value)}>
            <option value="">Выбери версию</option>
            {versions.map(v => <option key={v} value={v}>Версия {v}</option>)}
          </select>
        </label>
        <button type="button" disabled={!restore || busy || loading} onClick={() => void restoreVersion()}>
          <Check size={15}/> Загрузить
        </button>
      </aside>
    </div>
  </main>;
}

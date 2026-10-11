import { useState } from 'react';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import { GAME_SYSTEMS, systemKeys } from '../../lib/models';
import type { GameSystem } from '../../lib/models';
import TemplateAdmin from '../pathfinder/TemplateAdmin';
import MoonLayoutAdmin from '../project-moon/MoonLayoutAdmin';
import './SheetAdmin.css';

export default function SheetAdmin({userId,onClose}: {userId: string; onClose: () => void}) {
  const [system,setSystem] = useState<GameSystem | null>(null);
  if (system === 'pf2e') return <TemplateAdmin userId={userId} onClose={() => setSystem(null)} backLabel="← К выбору листа"/>;
  if (system === 'prmoon') return <MoonLayoutAdmin userId={userId} onClose={() => setSystem(null)}/>;

  return <main className="page sheet-admin-chooser">
    <button type="button" className="text-button" onClick={onClose}><ArrowLeft size={17}/> К персонажам</button>
    <header className="sheet-admin-intro">
      <FilePenLine size={26}/>
      <h1>Редактор листов</h1>
      <p>Выбери систему, оформление которой хочешь редактировать. Черновики и публикации каждой системы независимы.</p>
    </header>
    <div className="sheet-admin-system-list">
      {systemKeys.map(key => {
        const active = key === 'pf2e' || key === 'prmoon';
        const game = GAME_SYSTEMS[key];
        return <button key={key} type="button" disabled={!active}
          onClick={() => setSystem(key)} className="sheet-admin-system-option">
          <span className="sheet-admin-system-code">{game.code}</span>
          <span className="sheet-admin-system-text"><strong>{game.title}</strong>
            <small>{key === 'pf2e' ? 'Редактор полей PDF и предпросмотр' :
              key === 'prmoon' ? 'Редактор оформления HTML-досье и предпросмотр' :
              'Лист для этой системы пока не создан'}</small>
          </span>
          <span className="sheet-admin-system-status">{active ? 'Открыть →' : 'Позже'}</span>
        </button>;
      })}
    </div>
  </main>;
}

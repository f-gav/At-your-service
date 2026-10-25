import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, X } from 'lucide-react';
import { MOON_PAGES } from './model';
import { moveMoonPage, shiftMoonPage } from './page-order';
import type { MoonPage } from './model';
import '../pathfinder/PageSettingsDialog.css';

const labels: Record<MoonPage, string> = Object.fromEntries(
  MOON_PAGES.map(page => [page.id, page.title])
) as Record<MoonPage, string>;

export default function MoonPageSettingsDialog({
  order, hiddenPages, onPageVisibility, disabled = false, onOrderChange, onClose,
}: {
  order: MoonPage[];
  hiddenPages: MoonPage[];
  onPageVisibility: (page:MoonPage,visible:boolean)=>void;
  disabled?: boolean;
  onOrderChange: (order: MoonPage[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  const dragFrom = useRef<MoonPage | null>(null);
  const [over, setOver] = useState<MoonPage | null>(null);
  closeCallback.current = onClose;
  const visibleCount = order.filter(id=>!hiddenPages.includes(id)).length;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeCallback.current(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled)'))
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault(); focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault(); focusable[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previouslyFocused?.focus(); };
  }, []);

  const drop = (event: DragEvent<HTMLLIElement>, destination: MoonPage) => {
    event.preventDefault();
    const source = dragFrom.current;
    dragFrom.current = null;
    setOver(null);
    if (source && !disabled && source !== destination) onOrderChange(moveMoonPage(order, source, destination));
  };

  return createPortal(<div className="pf-pages-backdrop"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="pf-pages-dialog" ref={dialog} role="dialog" aria-modal="true"
      aria-labelledby="moon-pages-title" aria-describedby="moon-pages-description">
      <div className="pf-pages-header">
        <h2 id="moon-pages-title">Страницы листа</h2>
        <button type="button" className="pf-pages-close" ref={close}
          onClick={onClose} aria-label="Закрыть"><X size={19}/></button>
      </div>
      <p id="moon-pages-description">
        Перетащи страницы за значок слева или используй стрелки.
        Скрой ненужные страницы значком глаза или меняй их порядок стрелками и перетаскиванием. Текст, ресурсы и остальные данные сохраняются.
      </p>
      <ol className="pf-pages-list" aria-label="Порядок страниц">
        {order.map((id,index) => <li key={id} draggable={!disabled}
          className={'pf-pages-item' + (over === id ? ' pf-pages-drag-target' : '')+(hiddenPages.includes(id)?' pf-pages-item-hidden':'')}
          onDragStart={event => {
            if (disabled) { event.preventDefault(); return; }
            dragFrom.current = id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
          }}
          onDragOver={event => { if (!disabled) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(id); }}}
          onDragLeave={() => setOver(current => current === id ? null : current)}
          onDragEnd={() => { dragFrom.current = null; setOver(null); }}
          onDrop={event => drop(event,id)}>
          <GripVertical className="pf-pages-grip" size={18} aria-hidden="true"/>
          <span className="pf-pages-number">{index + 1}</span>
          <span className="pf-pages-label">{labels[id]}{hiddenPages.includes(id)&&<small>Скрыта — содержимое сохранено</small>}</span>
          <div className="pf-pages-actions">
            <button type="button" disabled={disabled||(!hiddenPages.includes(id)&&visibleCount<=1)}
              aria-pressed={!hiddenPages.includes(id)}
              title={hiddenPages.includes(id)?'Показать страницу':'Скрыть страницу'}
              aria-label={(hiddenPages.includes(id)?'Показать':'Скрыть')+' страницу «'+labels[id]+'»'}
              onClick={()=>onPageVisibility(id,hiddenPages.includes(id))}>
              {hiddenPages.includes(id)?<EyeOff size={17}/>:<Eye size={17}/>}
            </button>
            <button type="button" disabled={disabled || index === 0}
              aria-label={'Переместить «' + labels[id] + '» выше'}
              onClick={() => onOrderChange(shiftMoonPage(order, id, -1))}><ArrowUp size={17}/></button>
            <button type="button" disabled={disabled || index === order.length - 1}
              aria-label={'Переместить «' + labels[id] + '» ниже'}
              onClick={() => onOrderChange(shiftMoonPage(order, id, 1))}><ArrowDown size={17}/></button>
          </div>
        </li>)}
      </ol>
      <p className="pf-pages-notice">Скрытие страницы не удаляет её содержимое. В любой момент верни страницу кнопкой с глазом.</p>
      <div className="pf-pages-footer"><button type="button" onClick={onClose}>Готово</button></div>
    </div>
  </div>, document.body);
}

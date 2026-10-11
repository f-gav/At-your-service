import {useEffect,useRef,useState} from 'react';
import type {DragEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,GripVertical,X} from 'lucide-react';
import {
  PAGE_LABELS,visiblePageOrder,movePage,shiftVisiblePage,
} from './page-order';
import type {PfPageId} from './page-order';
import './PageSettingsDialog.css';

type Props={
  order:PfPageId[];
  notesEnabled:boolean;
  disabled?:boolean;
  onNotesEnabled:(enabled:boolean)=>void;
  onOrderChange:(order:PfPageId[])=>void;
  onClose:()=>void;
};

export default function PageSettingsDialog({
  order,notesEnabled,disabled=false,onNotesEnabled,onOrderChange,onClose,
}:Props){
  const dialog=useRef<HTMLDivElement>(null);
  const close=useRef<HTMLButtonElement>(null);
  const closeCallback=useRef(onClose);
  const dragFrom=useRef<PfPageId|null>(null);
  const [over,setOver]=useState<PfPageId|null>(null);
  closeCallback.current=onClose;
  const pages=visiblePageOrder(order,notesEnabled);
  useEffect(()=>{
    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    close.current?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeCallback.current();return;}
      if(event.key!=='Tab'||!dialog.current)return;
      const items=Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled)'
      )).filter(x=>x.getClientRects().length>0);
      if(!items.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){
        event.preventDefault();items[items.length-1].focus();
      }else if(!event.shiftKey&&document.activeElement===items[items.length-1]){
        event.preventDefault();items[0].focus();
      }
    };
    document.addEventListener('keydown',handleKey);
    return ()=>{document.removeEventListener('keydown',handleKey);previouslyFocused?.focus();};
  },[]);
  const startDrag=(event:DragEvent<HTMLLIElement>,id:PfPageId)=>{
    if(disabled){event.preventDefault();return;}
    dragFrom.current=id;
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',id);
  };
  const dropPage=(event:DragEvent<HTMLLIElement>,destination:PfPageId)=>{
    event.preventDefault();
    const source=dragFrom.current;
    dragFrom.current=null;
    setOver(null);
    if(source&&source!==destination&&!disabled)onOrderChange(movePage(order,source,destination));
  };
  return createPortal(
    <div className="pf-pages-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="pf-pages-dialog" ref={dialog} role="dialog" aria-modal="true"
        aria-labelledby="pf-pages-title" aria-describedby="pf-pages-description">
        <div className="pf-pages-header">
          <h2 id="pf-pages-title">Страницы листа</h2>
          <button type="button" className="pf-pages-close" ref={close}
            onClick={onClose} aria-label="Закрыть"><X size={19}/></button>
        </div>
        <label className="pf-pages-notes-toggle">
          <input type="checkbox" disabled={disabled}
            checked={notesEnabled} onChange={e=>onNotesEnabled(e.target.checked)}/>
          <span>Дополнительный лист заметок</span>
        </label>
        <p id="pf-pages-description">
          Перетащи страницы за значок слева или используй стрелки.
          Изменяется только порядок отображения: содержимое и расчёты сохраняются.
        </p>
        <ol className="pf-pages-list" aria-label="Порядок страниц">
          {pages.map((id,index)=><li key={id}
            draggable={!disabled}
            className={'pf-pages-item'+(over===id?' pf-pages-drag-target':'')}
            onDragStart={event=>startDrag(event,id)}
            onDragOver={event=>{if(!disabled){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(id);}}}
            onDragLeave={()=>setOver(current=>current===id?null:current)}
            onDragEnd={()=>{dragFrom.current=null;setOver(null);}}
            onDrop={event=>dropPage(event,id)}>
            <GripVertical size={18} className="pf-pages-grip" aria-hidden="true"/>
            <span className="pf-pages-number">{index+1}</span>
            <span className="pf-pages-label">{PAGE_LABELS[id]}{id==='notes'&&<small>Дополнительная страница</small>}</span>
            <div className="pf-pages-actions">
              <button type="button" disabled={disabled||index===0} title="Поднять страницу"
                aria-label={'Переместить «'+PAGE_LABELS[id]+'» выше'}
                onClick={()=>onOrderChange(shiftVisiblePage(order,id,-1,notesEnabled))}>
                <ArrowUp size={17}/>
              </button>
              <button type="button" disabled={disabled||index===pages.length-1} title="Опустить страницу"
                aria-label={'Переместить «'+PAGE_LABELS[id]+'» ниже'}
                onClick={()=>onOrderChange(shiftVisiblePage(order,id,1,notesEnabled))}>
                <ArrowDown size={17}/>
              </button>
            </div>
          </li>)}
        </ol>
        <p className="pf-pages-notice">
          Выключение дополнительного листа только скрывает его. Все заметки сохранятся и вернутся при повторном включении.
        </p>
        <div className="pf-pages-footer">
          <button type="button" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>,document.body);
}

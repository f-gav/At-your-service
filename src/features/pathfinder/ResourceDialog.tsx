import { useEffect, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import type {ResourceConfig,Recovery,FormulaContext,ResourceDisplay} from './resource-widget';
import {normalizeResource,resourceEffectiveMax,RESOURCE_CELL_LIMIT} from './resource-widget';
import './ResourceDialog.css';

type Props={
  resource:ResourceConfig;
  resourceContext?:FormulaContext;
  onSave:(resource:ResourceConfig)=>void;
  onClose:()=>void;
  onDelete:()=>void;
};

export default function ResourceDialog({resource,resourceContext={},onSave,onClose,onDelete}:Props){
  const [name,setName]=useState(resource.name);
  const [current,setCurrent]=useState(String(resource.current));
  const [maximum,setMaximum]=useState(resource.max===null?'':String(resource.max));
  const [display,setDisplay]=useState<ResourceDisplay>(resource.display);
  const [maximumMode,setMaximumMode]=useState<'manual'|'formula'>(resource.maxFormula?'formula':'manual');
  const [formula,setFormula]=useState(resource.maxFormula);
  const [recovery,setRecovery]=useState<Recovery>(resource.recovery);
  const [notes,setNotes]=useState(resource.notes);
  const [showNotes,setShowNotes]=useState(resource.showNotes);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const closeButton=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    closeButton.current?.focus();
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        const all=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'
        )??[]).filter(el=>el.offsetParent!==null);
        if(!all.length)return;
        const first=all[0],last=all[all.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('keydown',escape);focused?.focus();};
  },[onClose]);
  const candidate=normalizeResource({
    name:name.trim()||'Ресурс',current,
    max:maximum.trim()===''?null:maximum,
    maxFormula:maximumMode==='formula'?formula.trim():'',
    display,recovery,notes,showNotes,
  });
  const preview=resourceEffectiveMax(candidate,resourceContext);
  const unavailableVariable=preview.error?.startsWith('Заполни поле «')??false;
  const invalidFormula=maximumMode==='formula'&&(!formula.trim()||Boolean(preview.error&&!unavailableVariable));
  const missingCellMaximum=display==='cells'&&maximumMode==='manual'&&maximum.trim()==='';
  const submit=(event:React.FormEvent)=>{
    event.preventDefault();
    if(invalidFormula||missingCellMaximum)return;
    const resolved=preview.value;
    onSave({...candidate,current:resolved===null?candidate.current:Math.min(candidate.current,resolved)});
  };
  return createPortal(<div className="pf-resource-backdrop"
    onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={dialogRef} className="pf-resource-dialog" role="dialog" aria-modal="true"
      aria-labelledby="pf-resource-settings-title">
      <h2 id="pf-resource-settings-title">Настройки ресурса</h2>
      <form onSubmit={submit}>
        <label>Название
          <input type="text" maxLength={100} value={name} onChange={event=>setName(event.target.value)}/>
        </label>
        <label>Отображение
          <select value={display} onChange={event=>setDisplay(event.target.value as ResourceDisplay)}>
            <option value="counter">Числовой счётчик (2 / 5)</option>
            <option value="cells">Нажимаемые ячейки (◆ ◆ ◇ ◇ ◇)</option>
          </select>
        </label>
        <label>Тип максимума
          <select value={maximumMode} onChange={event=>setMaximumMode(event.target.value as 'manual'|'formula')}>
            <option value="manual">Указать вручную</option>
            <option value="formula">Рассчитывать по формуле</option>
          </select>
        </label>
        <div className="pf-resource-dialog-numbers">
          <label>Количество
            <input type="number" min="0" max="999999" step="1" value={current}
              onChange={event=>setCurrent(event.target.value)}/>
          </label>
          {maximumMode==='manual'
            ? <label>Максимум
                <input type="number" min="0" max="999999" step="1"
                  value={maximum} placeholder="Без ограничения"
                  onChange={event=>setMaximum(event.target.value)}/>
              </label>
            : <label>Расчётный максимум
                <input type="text" value={formula} maxLength={120}
                  placeholder="уровень + харизма + 2"
                  aria-invalid={invalidFormula}
                  onChange={event=>setFormula(event.target.value)}/>
              </label>}
        </div>
        {maximumMode==='formula'
          ? <>
              <p className="pf-resource-dialog-hint">Переменные: уровень, сила, ловкость, выносливость, интеллект, мудрость, харизма. Допустимы числа, +, −, × (*), ÷ (/) и скобки. Например: <code>уровень + харизма + 2</code>.</p>
              <p className={'pf-resource-preview'+(preview.error?' pf-resource-preview-warning':'')}
                aria-live="polite">{preview.error?'Максимум пока не вычислен: '+preview.error:'Расчётный максимум: '+preview.value}</p>
            </>
          : <p className="pf-resource-dialog-hint">Оставь максимум пустым для неограниченного счётчика. Для режима ячеек максимум обязателен.</p>}
        {display==='cells'&&<p className="pf-resource-dialog-hint">
          Ячейки доступны при максимуме от 1 до {RESOURCE_CELL_LIMIT}. Если формула позднее превысит лимит, ресурс временно покажется числовым счётчиком без потери данных.
        </p>}
        {missingCellMaximum&&<p className="pf-resource-preview-warning" role="alert">Для ячеек укажи максимум или выбери формулу.</p>}
        <label>Восстановление
          <select value={recovery} onChange={event=>setRecovery(event.target.value as Recovery)}>
            <option value="none">Без автоматического восстановления</option>
            <option value="ten_minutes">10-минутный отдых</option>
            <option value="daily">Ежедневная подготовка</option>
          </select>
        </label>
        <p className="pf-resource-dialog-hint">Тип восстановления сохраняется в листе. Пока общий механизм отдыха не добавлен, запас можно восстановить вручную кнопкой ↺.</p>
        <label>Заметки
          <textarea rows={3} maxLength={3000} value={notes}
            onChange={event=>setNotes(event.target.value)}/>
        </label>
        <label className="pf-resource-check">
          <input type="checkbox" checked={showNotes} onChange={event=>setShowNotes(event.target.checked)}/>
          Показывать заметки по нажатию на значок i
        </label>
        <div className="pf-resource-dialog-actions">
          {confirmDelete
            ? <>
                <span className="pf-resource-delete-question">Удалить ресурс?</span>
                <button type="button" onClick={()=>setConfirmDelete(false)}>Нет</button>
                <button type="button" className="pf-resource-danger" onClick={onDelete}>Удалить</button>
              </>
            : <>
                <button type="button" className="pf-resource-remove" onClick={()=>setConfirmDelete(true)}>Удалить ресурс</button>
                <span className="pf-resource-dialog-spacer"/>
                <button type="button" ref={closeButton} onClick={onClose}>Отмена</button>
                <button type="submit" className="pf-resource-primary" disabled={invalidFormula||missingCellMaximum}>Сохранить</button>
              </>}
        </div>
      </form>
    </div>
  </div>,document.body);
}

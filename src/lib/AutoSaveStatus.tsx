import {AlertCircle,Check,Cloud,LoaderCircle,RefreshCw} from 'lucide-react';
import type {AutoSavePhase} from './use-auto-save';
import './AutoSaveStatus.css';

export default function AutoSaveStatus({
  phase, error, savedAt, onRetry, className='',
}:{
  phase:AutoSavePhase;
  error?:string;
  savedAt:number|null;
  onRetry:()=>void;
  className?:string;
}) {
  const status=phase==='saved'?'Сохранено в облаке'
    :phase==='saving'?'Сохраняется…'
      :phase==='error'?'Ошибка сохранения':'Есть изменения';
  return <span className={'auto-save-indicator auto-save-'+phase+' '+className}
    aria-live="polite" aria-atomic="true"
    title={phase==='saved' && savedAt
      ? 'Сохранено в '+new Date(savedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
      :error||status}>
    {phase==='saved'?<Check size={14}/>:phase==='saving'?<LoaderCircle size={14} className="auto-save-spinner"/>:
      phase==='error'?<AlertCircle size={14}/>:<Cloud size={14}/>}
    <span>{status}</span>
    {phase==='error' && <button type="button" className="auto-save-retry"
      onClick={onRetry} title={error||'Повторить сохранение'} aria-label="Повторить сохранение">
      <RefreshCw size={14}/> Повторить
    </button>}
  </span>;
}

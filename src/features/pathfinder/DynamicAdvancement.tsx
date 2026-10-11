import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { FieldValue } from './sheet-values';
import { MAX_ADVANCEMENT_LEVEL, ancestryHint, classHint } from './advancement-model';
import './DynamicAdvancement.css';
import RichField from './RichField';

type Props={
  values:Record<string,FieldValue>;
  count:number;
  pageArtUrl:string;
  onValueChange:(id:string,value:string)=>void;
  onAdd:()=>void;
  onRemove:(level:number)=>void;
  disabled?:boolean;
};

function StretchField({id,hint,value,onChange,disabled}:{
  id:string;hint:string;value:string;onChange:(value:string)=>void;disabled?:boolean;
}){
  return <RichField id={'pf-'+id} label={hint} placeholder={hint}
    className="pf-advancement-rich" grow value={value} onChange={onChange}
    disabled={disabled}/>;
}

function LevelBadge({level,canRemove,onRemove,disabled}:{
  level:number;canRemove:boolean;onRemove:()=>void;disabled?:boolean;
}){
  if(!canRemove){
    return <div className="pf-advancement-level pf-advancement-first" aria-label="Уровень 1">
      <span>Уровень</span><strong>1</strong>
    </div>;
  }
  return <button className="pf-advancement-level pf-advancement-star" type="button"
    aria-label={'Удалить уровень '+level} title={undefined} disabled={disabled}
    onClick={onRemove}>
    <span className="pf-advancement-level-number">{level}</span>
    <span className="pf-advancement-level-remove" aria-hidden="true">×</span>
  </button>;
}

/** Responsive HTML section replacing only the original PDF's left advancement
 * illustration. The right-side inventory remains native, and the section
 * participates in document flow so an extra-long level grows the whole page.
 */
export default function DynamicAdvancement({values,count,pageArtUrl,onValueChange,onAdd,onRemove,disabled}:Props){
  const read=(id:string)=>String(values[id]??'');
  const edit=(id:string)=>(value:string)=>onValueChange(id,value);
  const artStyle={'--pf-page-two-art':`url("${pageArtUrl}")`} as CSSProperties;
  const [pendingDelete,setPendingDelete]=useState<number|null>(null);
  const cancelRef=useRef<HTMLButtonElement>(null);
  const deleteRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(pendingDelete===null)return;
    const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        setPendingDelete(null);
      }
      if(event.key==='Tab'){
        if(event.shiftKey && document.activeElement===cancelRef.current){
          event.preventDefault();
          deleteRef.current?.focus();
        }else if(!event.shiftKey && document.activeElement===deleteRef.current){
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown',handleKey);
    return ()=>{
      document.removeEventListener('keydown',handleKey);
      previousFocus?.focus();
    };
  },[pendingDelete]);
  useEffect(()=>{if(disabled)setPendingDelete(null);},[disabled]);
  const dialog=pendingDelete!==null && typeof document!=='undefined' &&
    createPortal(<div className="pf-advancement-confirm-backdrop"
      onMouseDown={event=>{if(event.target===event.currentTarget)setPendingDelete(null);}}>
      <div className="pf-advancement-confirm" role="dialog" aria-modal="true"
        aria-labelledby="pf-level-confirm-title" aria-describedby="pf-level-confirm-description">
        <h2 id="pf-level-confirm-title">Удалить уровень {pendingDelete}?</h2>
        <p id="pf-level-confirm-description">Вы точно хотите удалить уровень? Записи следующих уровней переместятся выше.</p>
        <div className="pf-advancement-confirm-actions">
          <button type="button" ref={cancelRef} onClick={()=>setPendingDelete(null)}>Отмена</button>
          <button type="button" ref={deleteRef} className="pf-advancement-confirm-delete"
            disabled={disabled} onClick={()=>{
              if(pendingDelete!==null && pendingDelete>1)onRemove(pendingDelete);
              setPendingDelete(null);
            }}>Удалить</button>
        </div>
      </div>
    </div>,document.body);
  return <>
  <div className="pf-advancement" style={artStyle} aria-label="Черты народа, общие черты и классовые способности">
    <div className="pf-advancement-head">
      <strong>Черты народа и общие черты</strong>
      <strong>Классовые способности</strong>
    </div>
    <div className="pf-advancement-levels">
      <div className="pf-advancement-row pf-advancement-row-first">
        <LevelBadge level={1} canRemove={false} disabled={disabled} onRemove={()=>{}}/>
        <div className="pf-advancement-left pf-advancement-first-fields">
          <StretchField id="ancestry_features" hint="Способности народа и родословной"
            value={read('ancestry_features')} onChange={edit('ancestry_features')} disabled={disabled}/>
          <StretchField id="ancestry_feat_1" hint="Черта народа"
            value={read('ancestry_feat_1')} onChange={edit('ancestry_feat_1')} disabled={disabled}/>
          <StretchField id="background_skill_feat" hint="Черта навыка за происхождение"
            value={read('background_skill_feat')} onChange={edit('background_skill_feat')} disabled={disabled}/>
        </div>
        <div className="pf-advancement-right">
          <StretchField id="class_features_1" hint="Классовые черты и особенности"
            value={read('class_features_1')} onChange={edit('class_features_1')} disabled={disabled}/>
        </div>
      </div>
      {Array.from({length:Math.max(0,Math.min(count,MAX_ADVANCEMENT_LEVEL)-1)},(_,i)=>i+2).map(level=>
        <div className="pf-advancement-row pf-advancement-row-extra" key={level}>
          <LevelBadge level={level} canRemove disabled={disabled} onRemove={()=>setPendingDelete(level)}/>
          <div className="pf-advancement-left">
            <StretchField id={'feat_level_'+level} hint={ancestryHint(level)}
              value={read('feat_level_'+level)} onChange={edit('feat_level_'+level)} disabled={disabled}/>
          </div>
          <div className="pf-advancement-right">
            <StretchField id={'class_level_'+level} hint={classHint(level)}
              value={read('class_level_'+level)} onChange={edit('class_level_'+level)} disabled={disabled}/>
          </div>
        </div>
      )}
      {count<MAX_ADVANCEMENT_LEVEL&&<div className="pf-advancement-add-row">
        <button type="button" className="pf-advancement-add-star"
          onClick={onAdd} disabled={disabled} aria-label="Добавить уровень"
          title="Добавить следующий уровень">
          <span aria-hidden="true">+</span>
        </button>
        <div className="pf-advancement-add-half"/>
        <div className="pf-advancement-add-half"/>
      </div>}
    </div>
  </div>
  {dialog}
  </>;
}

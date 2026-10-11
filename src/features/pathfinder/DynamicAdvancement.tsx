import { useLayoutEffect, useRef } from 'react';
import type { FieldValue } from './sheet-values';
import { MAX_ADVANCEMENT_LEVEL, ancestryHint, classHint } from './advancement-model';
import './DynamicAdvancement.css';

type Props={
  values:Record<string,FieldValue>;
  count:number;
  onValueChange:(id:string,value:string)=>void;
  onAdd:()=>void;
  onRemove:(level:number)=>void;
  disabled?:boolean;
};

function StretchField({id,hint,value,onChange,disabled}:{
  id:string;hint:string;value:string;onChange:(value:string)=>void;disabled?:boolean;
}){
  const ref=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{
    const target=ref.current;
    if(!target)return;
    target.style.height='auto';
    target.style.height=target.scrollHeight+'px';
  },[value]);
  return <textarea ref={ref} className="pf-advancement-input" id={'pf-'+id}
    aria-label={hint} placeholder={hint} value={value}
    rows={1} spellCheck={false} disabled={disabled}
    onChange={event=>onChange(event.target.value)} />;
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
export default function DynamicAdvancement({values,count,onValueChange,onAdd,onRemove,disabled}:Props){
  const read=(id:string)=>String(values[id]??'');
  const edit=(id:string)=>(value:string)=>onValueChange(id,value);
  return <div className="pf-advancement" aria-label="Черты народа, общие черты и классовые способности">
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
          <LevelBadge level={level} canRemove disabled={disabled} onRemove={()=>onRemove(level)}/>
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
  </div>;
}

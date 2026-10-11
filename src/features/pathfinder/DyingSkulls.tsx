import type {CSSProperties} from 'react';
import {DYING_SKULL_COUNT,readDyingSkulls,toggleDyingSkull} from './dying-skulls';
import './DyingSkulls.css';

/** Hit boxes cover the original four printed skull outlines.
 * No dropdown or text input; only the inside of a selected skull is inked.
 */
export default function DyingSkulls({
  value,onChange,disabled,style,
}:{
  value:unknown;
  onChange:(value:string)=>void;
  disabled?:boolean;
  style:CSSProperties;
}){
  const count=readDyingSkulls(value);
  return <div className="pf-field pf-dying-skulls" style={style}
    role="group" aria-label={'При смерти: '+count+' из '+DYING_SKULL_COUNT}>
    {Array.from({length:DYING_SKULL_COUNT},(_,i)=>{
      const slot=i+1;
      const selected=slot<=count;
      return <button type="button" key={slot}
        className="pf-dying-skull"
        aria-label={'При смерти, череп '+slot+' из '+DYING_SKULL_COUNT+
          (selected?', отмечен':', не отмечен')}
        aria-pressed={selected}
        disabled={disabled}
        onClick={()=>onChange(toggleDyingSkull(value,slot))}>
        <svg className="pf-dying-skull-ink" viewBox="0 0 32 34"
          focusable="false" aria-hidden="true">
          <path d="M16 3.3C9.4 3.3 5.4 7.8 5.4 14.5c0 4 1.8 6.5 4.9 8.6v6.1c0 1 .7 1.7 1.7 1.7h1.2v-2.5h2.1v2.5h1.5v-2.5h2.1v2.5H20c1 0 1.7-.7 1.7-1.7v-6.1c3.1-2.1 4.9-4.6 4.9-8.6 0-6.7-4-11.2-10.6-11.2Z"/>
        </svg>
      </button>;
    })}
  </div>;
}

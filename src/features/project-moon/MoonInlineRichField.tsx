import RichField from '../pathfinder/RichField';
import {toRichHtml} from '../pathfinder/rich-codec';
import type {FormulaContext} from '../pathfinder/resource-widget';

/** Keep mechanical fields plain while retaining their separately saved markup.
 * The existing Pathfinder rich editor provides bold/italic/links and dice chips.
 */
export function moonInlinePlain(rich:string):string {
  const fragment=document.createElement('template');
  fragment.innerHTML=toRichHtml(rich);
  return fragment.content.textContent??'';
}

type Props={
  id:string;
  label:string;
  value:string;
  formatted?:string;
  disabled?:boolean;
  placeholder?:string;
  resourceContext?:FormulaContext;
  onChange:(plain:string,formatted:string)=>void;
};

/** A one-line field that preserves the exact legacy plain value for rules/math. */
export default function MoonInlineRichField({
  id,label,value,formatted,disabled,placeholder,resourceContext,onChange,
}:Props){
  const display=formatted&&moonInlinePlain(formatted)===value?formatted:value;
  return <div className="moon-inline-rich-wrap" onKeyDownCapture={event=>{
    if(event.key==='Enter'&&!event.shiftKey)event.preventDefault();
  }}>
    <RichField id={id} label={label} value={display}
      className="moon-inline-rich" disabled={disabled}
      placeholder={placeholder} resourceContext={resourceContext}
      onChange={rich=>onChange(moonInlinePlain(rich),rich)}/>
  </div>;
}

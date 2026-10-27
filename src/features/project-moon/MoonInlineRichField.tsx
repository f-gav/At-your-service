import RichField from '../pathfinder/RichField';
import {toRichHtml} from '../pathfinder/rich-codec';
import type {FormulaContext} from '../pathfinder/resource-widget';

/** Extract a mechanical plain-text value from safe rich HTML. Preserve line
 * breaks between blocks, rather than merging adjacent words or dice formulas.
 * Only the rich markup is decorative; the original game field remains text. */
export function moonInlinePlain(rich:string):string {
  const fragment=document.createElement('template');
  fragment.innerHTML=toRichHtml(rich);
  const visit=(node:Node):string=>{
    if(node.nodeType===Node.TEXT_NODE)return node.textContent??'';
    if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return '';
    if(node.nodeType===Node.ELEMENT_NODE&&(node as Element).tagName==='BR')return '\n';
    const children=Array.from(node.childNodes);
    const contents=children.map(visit);
    return contents.map((part,index)=>{
      if(index===0)return part;
      const prev=children[index-1];
      const prevBlock=prev.nodeType===Node.ELEMENT_NODE&&['DIV','P','LI','UL','OL'].includes((prev as Element).tagName);
      const thisBlock=children[index].nodeType===Node.ELEMENT_NODE&&['DIV','P','LI','UL','OL'].includes((children[index] as Element).tagName);
      return (prevBlock||thisBlock)&&contents[index-1]&&!contents[index-1].endsWith('\n')?'\n'+part:part;
    }).join('');
  };
  return visit(fragment.content);
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

/** Compact rich field: use the proven PF2e floating selection menu (including
 * dice chips) without intercepting keyboard events from its PORTALED dialogs.
 * Previous onKeyDownCapture blocked Enter on the formula editor/modal because
 * React routes portal events through the React parent tree. */
export default function MoonInlineRichField({
  id,label,value,formatted,disabled,placeholder,resourceContext,onChange,
}:Props){
  const display=formatted&&moonInlinePlain(formatted)===value?formatted:value;
  return <div className="moon-inline-rich-wrap">
    <RichField id={id} label={label} value={display}
      className="moon-inline-rich" disabled={disabled}
      placeholder={placeholder} resourceContext={resourceContext}
      onChange={rich=>onChange(moonInlinePlain(rich),rich)}/>
  </div>;
}

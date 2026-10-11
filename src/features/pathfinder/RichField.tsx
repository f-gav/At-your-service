import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Italic, Underline, List, ListChecks, Link2, Diamond } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toRichHtml, sanitizeRichHtml, serializeRichHtml } from './rich-codec';
import './RichField.css';

type Props={
  id:string;label:string;value:string;onChange:(value:string)=>void;
  placeholder?:string;disabled?:boolean;className?:string;
  style?:CSSProperties;grow?:boolean;
};
type Tool = 'bold'|'italic'|'underline'|'bullet'|'task'|'resource'|'link';
type Spot={left:number;top:number};
function popupPosition(rect:DOMRect):Spot {
  const width=370;
  return {left:Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2)),
    top:Math.max(8,rect.top-57)};
}
export default function RichField({id,label,value,onChange,placeholder,disabled,className='',style,grow=false}:Props){
  const root=useRef<HTMLDivElement>(null);
  const rangeRef=useRef<Range|null>(null);
  const [spot,setSpot]=useState<Spot|null>(null);
  const [linkMode,setLinkMode]=useState(false);
  const [url,setUrl]=useState('https://');
  const linkInput=useRef<HTMLInputElement>(null);
  const ownValue=useRef<string|null>(null);

  useLayoutEffect(()=>{
    const editor=root.current;
    if(!editor||document.activeElement===editor&&value===ownValue.current)return;
    const html=toRichHtml(value);
    if(editor.innerHTML!==html)editor.innerHTML=html;
  },[value]);

  function emit(){
    const editor=root.current;
    if(!editor)return;
    const next=serializeRichHtml(editor.innerHTML);
    ownValue.current=next;
    onChange(next);
  }
  function refresh(){
    const editor=root.current;
    const sel=window.getSelection();
    if(!editor||!sel||sel.isCollapsed||!sel.rangeCount||!sel.toString().trim()){
      setSpot(null);setLinkMode(false);return;
    }
    const range=sel.getRangeAt(0);
    const host=range.commonAncestorContainer;
    if(!editor.contains(host)){setSpot(null);setLinkMode(false);return;}
    const rect=range.getBoundingClientRect();
    if(!rect.width&&!rect.height){setSpot(null);return;}
    rangeRef.current=range.cloneRange();
    setSpot(popupPosition(rect));
  }
  useEffect(()=>{
    const onSelection=()=>refresh();
    document.addEventListener('selectionchange',onSelection);
    const onViewport=()=>setSpot(null);
    window.addEventListener('scroll',onViewport,true);
    window.addEventListener('resize',onViewport);
    return()=>{
      document.removeEventListener('selectionchange',onSelection);
      window.removeEventListener('scroll',onViewport,true);
      window.removeEventListener('resize',onViewport);
    };
  },[]);

  function restore(){
    const range=rangeRef.current;
    if(!range)return;
    root.current?.focus();
    const selection=window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  function apply(tool:Tool){
    restore();
    if(tool==='link'){setLinkMode(true);setTimeout(()=>linkInput.current?.focus(),0);return;}
    if(tool==='bold')document.execCommand('bold',false);
    if(tool==='italic')document.execCommand('italic',false);
    if(tool==='underline')document.execCommand('underline',false);
    if(tool==='bullet')document.execCommand('insertUnorderedList',false);
    if(tool==='resource')document.execCommand('insertHTML',false,
      '<span data-pf-resource="1" data-filled="0" contenteditable="false" role="button" tabindex="0">◇</span> ');
    if(tool==='task'){
      const text=window.getSelection()?.toString()||'';
      const selected=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      document.execCommand('insertHTML',false,
        '<span data-pf-task="1" data-filled="0" contenteditable="false" role="button" tabindex="0">☐</span> '+selected);
    }
    emit();
    setSpot(null);setLinkMode(false);
  }
  function applyLink(){
    if(!/^https?:\/\/\S+$/i.test(url))return;
    restore();
    document.execCommand('createLink',false,url);
    emit();setSpot(null);setLinkMode(false);
  }
  function toggleToken(node:HTMLElement){
    const filled=node.dataset.filled==='1';
    node.dataset.filled=filled?'0':'1';
    node.textContent=node.dataset.pfResource==='1'?(filled?'◇':'◆'):(filled?'☐':'☑');
    emit();
  }
  function handleTokenClick(event:ReactMouseEvent<HTMLDivElement>){
    const target=event.target instanceof HTMLElement?event.target.closest<HTMLElement>('[data-pf-resource],[data-pf-task]'):null;
    if(target&&root.current?.contains(target)){event.preventDefault();toggleToken(target);}
  }
  function handlePaste(event:React.ClipboardEvent<HTMLDivElement>){
    event.preventDefault();
    // Never import active HTML or untrusted markup from pasted websites.
    const text=event.clipboardData.getData('text/plain');
    document.execCommand('insertText',false,text);
    emit();
  }
  const toolbar=spot&&!disabled&&typeof document!=='undefined'&&createPortal(
    <div className="pf-rich-toolbar" role="toolbar" aria-label="Форматирование выделенного текста"
      style={{left:spot.left,top:spot.top}} onMouseDown={event=>event.preventDefault()}>
      {linkMode
        ? <form className="pf-rich-link-form" onSubmit={event=>{event.preventDefault();applyLink();}}>
            <input ref={linkInput} value={url} type="url" aria-label="Адрес ссылки" onChange={e=>setUrl(e.target.value)}/>
            <button type="submit" title="Применить ссылку">OK</button>
            <button type="button" onClick={()=>setLinkMode(false)}>×</button>
          </form>
        : <>
            <button type="button" aria-label="Жирный" title="Жирный" onClick={()=>apply('bold')}><Bold size={17}/></button>
            <button type="button" aria-label="Курсив" title="Курсив" onClick={()=>apply('italic')}><Italic size={17}/></button>
            <button type="button" aria-label="Подчёркнутый" title="Подчёркнутый" onClick={()=>apply('underline')}><Underline size={17}/></button>
            <span className="pf-rich-toolbar-separator"/>
            <button type="button" aria-label="Маркированный список" title="Маркированный список" onClick={()=>apply('bullet')}><List size={17}/></button>
            <button type="button" aria-label="Чекбокс" title="Чекбокс" onClick={()=>apply('task')}><ListChecks size={17}/></button>
            <span className="pf-rich-toolbar-separator"/>
            <button type="button" aria-label="Ссылка" title="Ссылка" onClick={()=>apply('link')}><Link2 size={17}/></button>
            <button type="button" aria-label="Ресурс" title="Ресурс — отмечаемая ячейка" onClick={()=>apply('resource')}><Diamond size={18}/></button>
          </>}
    </div>,document.body);
  return <>
    <div id={id} className={'pf-rich-host '+className} style={style}>
      <div ref={root} className={'pf-rich-editable'+(grow?' pf-rich-grow':'')}
        role="textbox" aria-label={label} aria-multiline="true"
        contentEditable={!disabled} suppressContentEditableWarning spellCheck={false}
        data-placeholder={placeholder??''}
        onInput={emit} onMouseUp={refresh} onKeyUp={refresh} onClick={handleTokenClick}
        onKeyDown={event=>{
          const target=event.target instanceof HTMLElement?event.target:null;
          if((event.key==='Enter'||event.key===' ')&&target?.matches('[data-pf-resource],[data-pf-task]')){
            event.preventDefault();toggleToken(target);
          }
        }}
        onPaste={handlePaste}/>
    </div>
    {toolbar}
  </>;
}

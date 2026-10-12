import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Italic, Underline, List, ListChecks, Link2, Diamond, Plus, Minus, PanelTopOpen, BatteryCharging } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toRichHtml, serializeRichHtml } from './rich-codec';
import { dividerMarkup, spoilerMarkup } from './rich-blocks';
import {resourceMarkup,resourceFromElement,stepResource,restoreResource,chooseResourceCell,effectiveResource,resourceEffectiveMax} from './resource-widget';
import type {ResourceConfig,FormulaContext} from './resource-widget';
import ResourceDialog from './ResourceDialog';
import {insertionMenuPosition} from './insert-menu-position';
import './RichField.css';

type Props={
  id:string;label:string;value:string;onChange:(value:string)=>void;
  placeholder?:string;disabled?:boolean;className?:string;
  style?:CSSProperties;grow?:boolean;resourceContext?:FormulaContext;spellColumns?:number[];
};
type Tool = 'bold'|'italic'|'underline'|'bullet'|'task'|'resource'|'link';
type Spot={left:number;top:number};
type InsertKind='spoiler'|'divider'|'resource';
function popupPosition(rect:DOMRect):Spot {
  const width=370;
  return {left:Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2)),
    top:Math.max(8,rect.top-57)};
}
export default function RichField({id,label,value,onChange,placeholder,disabled,className='',style,grow=false,resourceContext={},spellColumns}:Props){
  const root=useRef<HTMLDivElement>(null);
  const rangeRef=useRef<Range|null>(null);
  const pointerRef=useRef<{x:number;y:number}|null>(null);
  const [spot,setSpot]=useState<Spot|null>(null);
  const [insertSpot,setInsertSpot]=useState<Spot|null>(null);
  const [selectedResource,setSelectedResource]=useState<HTMLElement|null>(null);
  const [linkMode,setLinkMode]=useState(false);
  const [url,setUrl]=useState('https://');
  const linkInput=useRef<HTMLInputElement>(null);
  const ownValue=useRef<string|null>(null);

  useLayoutEffect(()=>{
    const editor=root.current;
    if(!editor||(editor.contains(document.activeElement)&&value===ownValue.current))return;
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
  // Update calculated caps in place, without rerendering unrelated text or
  // moving the selection in a feat's rich editor. Once a maximum shrinks, the
  // clamped current value is persisted immediately (no phantom refills).
  useLayoutEffect(()=>{
    const editor=root.current;
    if(!editor)return;
    let dataChanged=false;
    const widgets=Array.from(editor.querySelectorAll<HTMLElement>('[data-pf-resource-widget="1"]'));
    for(const widget of widgets){
      if(widget===selectedResource)continue;
      const stored=resourceFromElement(widget);
      const effective=effectiveResource(stored,resourceContext);
      const resolved=resourceEffectiveMax(stored,resourceContext);
      const count=resolved.error?stored.current:effective.current;
      const markup=resourceMarkup({...stored,current:count},resourceContext);
      const template=document.createElement('template');
      template.innerHTML=markup;
      const next=template.content.firstElementChild as HTMLElement|null;
      if(!next)continue;
      if(widget.dataset.infoOpen==='1')next.dataset.infoOpen='1';
      if(next.outerHTML!==widget.outerHTML)widget.replaceWith(next);
      if(count!==stored.current)dataChanged=true;
    }
    if(dataChanged)emit();
  },[resourceContext,value,selectedResource]);

  function blankLineAt(range:Range,editor:HTMLElement):HTMLElement|null {
    let element:HTMLElement|null=range.startContainer.nodeType===Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement : range.startContainer.parentElement;
    if(!element||!editor.contains(element)&&element!==editor)return null;
    if(element.closest('[data-pf-spoiler-title],[data-pf-divider-title],[data-pf-spoiler-head]'))return null;
    const line=element.closest<HTMLElement>('div,p');
    if(!line||!editor.contains(line))return editor.textContent?.trim()?null:editor;
    if(line.closest('[data-pf-divider]'))return null;
    if(line.matches('[data-pf-spoiler]'))return null;
    if(line.querySelector('[data-pf-divider],[data-pf-spoiler],[data-pf-resource],[data-pf-task]'))return null;
    return line.textContent?.trim() ? null : line;
  }
  function refresh(){
    const editor=root.current;
    const sel=window.getSelection();
    if(!editor||!sel||!sel.rangeCount){
      setSpot(null);setInsertSpot(null);return;
    }
    const range=sel.getRangeAt(0);
    const host=range.commonAncestorContainer;
    if(!editor.contains(host)&&host!==editor){
      setSpot(null);setInsertSpot(null);return;
    }
    rangeRef.current=range.cloneRange();
    if(sel.isCollapsed){
      setSpot(null);
      const line=blankLineAt(range,editor);
      if(line){
        const rect=range.getBoundingClientRect();
        const fallback=line.getBoundingClientRect();
        setInsertSpot(insertionMenuPosition(rect,fallback,{
          width:window.innerWidth,height:window.innerHeight,
        },pointerRef.current));
      }else setInsertSpot(null);
      return;
    }
    setInsertSpot(null);
    if(!sel.toString().trim()){setSpot(null);return;}
    const rect=range.getBoundingClientRect();
    if(!rect.width&&!rect.height){setSpot(null);return;}
    setSpot(popupPosition(rect));
  }
  useEffect(()=>{
    const onSelection=()=>refresh();
    document.addEventListener('selectionchange',onSelection);
    const onViewport=()=>{setSpot(null);setInsertSpot(null);};
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
  function placeCaret(el:HTMLElement){
    el.focus();
    const range=document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection=window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    rangeRef.current=range.cloneRange();
  }
  function addBlock(kind:InsertKind){
    const editor=root.current;
    if(!editor)return;
    restore();
    const selection=window.getSelection();
    const range=selection?.rangeCount?selection.getRangeAt(0):document.createRange();
    if(!selection?.rangeCount){range.selectNodeContents(editor);range.collapse(false);}
    const blank=blankLineAt(range,editor);
    // LSS inserts block widgets from a blank line, never over selected text.
    if(!blank)return;
    const template=document.createElement('template');
    template.innerHTML=(kind==='spoiler'?spoilerMarkup():kind==='divider'?dividerMarkup():resourceMarkup())+'<div><br></div>';
    if(kind==='spoiler'&&spellColumns?.length){
      const spoiler=template.content.firstElementChild as HTMLElement;
      const head=spoiler.querySelector<HTMLElement>('[data-pf-spoiler-head]');
      let title=head?.querySelector<HTMLElement>('[data-pf-spoiler-title]');
      if(head&&title){
        head.dataset.pfSpellColumns=String(spellColumns.length);
        head.style.setProperty('--pf-spell-heading-columns',spellColumns.map(w=>`${w}fr`).join(' '));
        for(let i=1;i<spellColumns.length;i++){
          const cell=document.createElement('span');
          cell.dataset.pfSpoilerTitle='1';
          cell.dataset.pfSpellColumn=String(i);
          cell.contentEditable='true';
          cell.setAttribute('role','textbox');
          cell.setAttribute('aria-label',`Заголовок спойлера — столбец ${i+1}`);
          title.after(cell);
          title=cell;
        }
      }
    }
    const fragment=template.content;
    const widget=fragment.firstElementChild as HTMLElement;
    if(blank===editor||blank.matches('[data-pf-spoiler-body]'))blank.replaceChildren(fragment);
    else blank.replaceWith(fragment);
    const title=kind==='resource'?null:widget.querySelector<HTMLElement>(kind==='spoiler'?'[data-pf-spoiler-title]':'[data-pf-divider-title]');
    emit();
    setSpot(null);setInsertSpot(null);
    if(title)placeCaret(title);
  }
  function convertDividerShortcut():boolean {
    const editor=root.current,sel=window.getSelection();
    if(!editor||!sel?.rangeCount||!sel.isCollapsed)return false;
    const range=sel.getRangeAt(0);
    let node=range.startContainer.nodeType===Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement : range.startContainer.parentElement;
    if(!node||!editor.contains(node))return false;
    if(node.closest('[data-pf-divider],[data-pf-spoiler-head]'))return false;
    const line=node.closest<HTMLElement>('div,p');
    if(!line||!editor.contains(line))return false;
    if(line.textContent!=='---'||line.children.length>0)return false;
    const template=document.createElement('template');
    template.innerHTML=dividerMarkup()+'<div><br></div>';
    const title=template.content.firstElementChild?.querySelector<HTMLElement>('[data-pf-divider-title]');
    if(line===editor||line.matches('[data-pf-spoiler-body]'))line.replaceChildren(template.content);
    else line.replaceWith(template.content);
    emit();
    if(title)placeCaret(title);
    setInsertSpot(null);
    return true;
  }
  function removeWidget(widget:HTMLElement){
    const editor=root.current;
    if(!editor)return;
    let next=widget.nextElementSibling as HTMLElement|null;
    if(!next){
      next=document.createElement('div');
      next.appendChild(document.createElement('br'));
      widget.after(next);
    }
    widget.remove();
    emit();
    placeCaret(next);
    setInsertSpot(null);setSpot(null);
  }
  function toggleSpoiler(spoiler:HTMLElement){
    const collapsed=spoiler.dataset.collapsed==='1';
    spoiler.dataset.collapsed=collapsed?'0':'1';
    const toggle=spoiler.querySelector('[data-pf-spoiler-toggle]');
    if(toggle)toggle.textContent=collapsed?'▾':'▸';
    emit();
    setSpot(null);setInsertSpot(null);
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
  function replaceResource(widget:HTMLElement,config:ResourceConfig){
    const template=document.createElement('template');
    template.innerHTML=resourceMarkup(config,resourceContext);
    widget.replaceWith(template.content);
    emit();
    setInsertSpot(null);setSpot(null);
  }
  function handleResourceAction(widget:HTMLElement,action:string){
    if(action==='settings'){setSelectedResource(widget);setInsertSpot(null);setSpot(null);return;}
    if(action==='info'){
      widget.dataset.infoOpen=widget.dataset.infoOpen==='1'?'0':'1';
      return;
    }
    const stored=resourceFromElement(widget);
    const resolved=resourceEffectiveMax(stored,resourceContext);
    if(resolved.error)return;
    const effective=effectiveResource(stored,resourceContext);
    if(action==='minus')replaceResource(widget,{...stored,current:stepResource(effective,-1).current});
    if(action==='plus')replaceResource(widget,{...stored,current:stepResource(effective,1).current});
    if(action==='restore')replaceResource(widget,{...stored,current:restoreResource(effective).current});
  }
  function handleResourceCell(widget:HTMLElement,index:number){
    const stored=resourceFromElement(widget);
    if(resourceEffectiveMax(stored,resourceContext).error)return;
    const effective=effectiveResource(stored,resourceContext);
    replaceResource(widget,{...stored,current:chooseResourceCell(effective,index).current});
  }
  function handleTokenClick(event:ReactMouseEvent<HTMLDivElement>){
    const target=event.target instanceof HTMLElement?event.target:null;
    if(!target||!root.current?.contains(target))return;
    const cell=target.closest<HTMLElement>('[data-pf-resource-cell]');
    if(cell){
      const widget=cell.closest<HTMLElement>('[data-pf-resource-widget]');
      if(widget){event.preventDefault();handleResourceCell(widget,Number(cell.dataset.pfResourceCell));}
      return;
    }
    const resourceAction=target.closest<HTMLElement>('[data-pf-resource-action]');
    if(resourceAction){
      const widget=resourceAction.closest<HTMLElement>('[data-pf-resource-widget]');
      if(widget){event.preventDefault();handleResourceAction(widget,resourceAction.dataset.pfResourceAction??'');}
      return;
    }
    const toggle=target.closest<HTMLElement>('[data-pf-spoiler-toggle]');
    if(toggle){
      event.preventDefault();
      const spoiler=toggle.closest<HTMLElement>('[data-pf-spoiler]');
      if(spoiler)toggleSpoiler(spoiler);
      return;
    }
    const remove=target.closest<HTMLElement>('[data-pf-spoiler-remove]');
    if(remove){
      event.preventDefault();
      const spoiler=remove.closest<HTMLElement>('[data-pf-spoiler]');
      if(spoiler)removeWidget(spoiler);
      return;
    }
    const divider=target.closest<HTMLElement>('[data-pf-divider]');
    if(divider&&!target.closest('[data-pf-divider-title]')){
      event.preventDefault();
      const title=divider.querySelector<HTMLElement>('[data-pf-divider-title]');
      if(title)placeCaret(title);
      return;
    }
    const token=target.closest<HTMLElement>('[data-pf-resource],[data-pf-task]');
    if(token){event.preventDefault();toggleToken(token);}
  }
  function handlePaste(event:React.ClipboardEvent<HTMLDivElement>){
    event.preventDefault();
    // Never import active HTML or untrusted markup from pasted websites.
    const text=event.clipboardData.getData('text/plain');
    document.execCommand('insertText',false,text);
    emit();
  }
  const insertToolbar=insertSpot&&!disabled&&typeof document!=='undefined'&&createPortal(
    <div className="pf-rich-insert-toolbar" role="toolbar"
      aria-label="Вставить блок на пустую строку"
      style={{left:insertSpot.left,top:insertSpot.top}}
      onMouseDown={event=>event.preventDefault()}>
      <span aria-hidden="true" className="pf-rich-insert-plus"><Plus size={15}/></span>
      <button type="button" title="Добавить спойлер" onClick={()=>addBlock('spoiler')}>
        <PanelTopOpen size={15}/> Спойлер
      </button>
      <button type="button" title="Добавить разделитель" onClick={()=>addBlock('divider')}>
        <Minus size={15}/> Разделитель
      </button>
      <button type="button" title="Добавить ресурс" onClick={()=>addBlock('resource')}>
        <BatteryCharging size={15}/> Ресурс
      </button>
    </div>,document.body);
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
        onInput={()=>{if(!convertDividerShortcut())emit();}}
        onMouseUp={event=>{pointerRef.current={x:event.clientX,y:event.clientY};refresh();}}
        onKeyUp={event=>{if(event.key!=='Shift')pointerRef.current=null;refresh();}}
        onClick={handleTokenClick}
        onKeyDown={event=>{
          const title=event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>('[data-pf-divider-title]') : null;
          const heading=event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>('[data-pf-spoiler-title]') : null;
          if(event.key==='Enter'&&heading){
            event.preventDefault();
            const body=heading.closest('[data-pf-spoiler]')?.querySelector<HTMLElement>('[data-pf-spoiler-body]');
            if(body)placeCaret(body);
            return;
          }
          if(event.key==='Enter'&&title){
            event.preventDefault();
            const divider=title.closest<HTMLElement>('[data-pf-divider]');
            if(divider){
              let next=divider.nextElementSibling as HTMLElement|null;
              if(!next){
                next=document.createElement('div');
                next.appendChild(document.createElement('br'));
                divider.after(next);
                emit();
              }
              placeCaret(next);
            }
            return;
          }
          if(event.key==='Backspace'&&title&&!title.textContent?.trim()){
            event.preventDefault();
            const divider=title.closest<HTMLElement>('[data-pf-divider]');
            if(divider)removeWidget(divider);
            return;
          }
          const target=event.target instanceof HTMLElement?event.target:null;
          if((event.key==='Enter'||event.key===' ')&&target?.matches('[data-pf-resource-cell]')){
            const widget=target.closest<HTMLElement>('[data-pf-resource-widget]');
            if(widget){event.preventDefault();handleResourceCell(widget,Number(target.dataset.pfResourceCell));}
            return;
          }
          if((event.key==='Enter'||event.key===' ')&&target?.matches('[data-pf-resource-action]')){
            const widget=target.closest<HTMLElement>('[data-pf-resource-widget]');
            if(widget){
              event.preventDefault();
              handleResourceAction(widget,target.dataset.pfResourceAction??'');
            }
            return;
          }
          if((event.key==='Enter'||event.key===' ')&&target?.matches('[data-pf-resource],[data-pf-task]')){
            event.preventDefault();toggleToken(target);
          }
        }}
        onPaste={handlePaste}/>
    </div>
    {toolbar}
    {insertToolbar}
    {selectedResource&&!disabled&&<ResourceDialog
      resource={resourceFromElement(selectedResource)}
      resourceContext={resourceContext}
      onClose={()=>setSelectedResource(null)}
      onSave={config=>{
        if(selectedResource)replaceResource(selectedResource,config);
        setSelectedResource(null);
      }}
      onDelete={()=>{
        if(selectedResource)removeWidget(selectedResource);
        setSelectedResource(null);
      }}/>}
  </>;
}

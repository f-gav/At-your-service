import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {GripVertical,Plus,X} from 'lucide-react';
import type {KeyboardEvent,MouseEvent,PointerEvent,ReactNode} from 'react';
import type {SpellView} from '../spell-library/catalog';
import {
  SPELL_ZONES,resolveSpellLayout,moveSpellLayout,addSpellDivider,
  setSpellDividerTitle,deleteSpellDivider,spellZoneRows,
} from './spell-layout';
import type {SpellZone,SpellLayoutRow} from './spell-layout';
import './SpellLayoutControls.css';

type DragState={id:string;pointerId:number;x:number;y:number};
type DropState={zone:SpellZone;anchorId?:string;after:boolean};
type MenuState={x:number;y:number;zone:SpellZone;rowId?:string};

function isZone(value:unknown):value is SpellZone{
  return typeof value==='string'&&(SPELL_ZONES as readonly string[]).includes(value);
}
function detectDrop(x:number,y:number):DropState|null{
  const hit=document.elementFromPoint(x,y);
  if(!(hit instanceof Element))return null;
  const container=hit.closest<HTMLElement>('[data-pf-spell-zone]');
  const zone=container?.dataset.pfSpellZone;
  if(!isZone(zone))return null;
  const row=hit.closest<HTMLElement>('[data-pf-spell-row]');
  if(row&&container?.contains(row)){
    const rect=row.getBoundingClientRect();
    return {zone,anchorId:row.dataset.pfSpellRow,after:y>rect.top+rect.height/2};
  }
  return {zone,after:true};
}
export function useSpellLayoutUi(
  spells:SpellView[],stored:unknown,onSave:(serialized:string)=>void,disabled:boolean,
){
  const raw=typeof stored==='string'?stored:'';
  const rows=useMemo(()=>resolveSpellLayout(spells,raw),[spells,raw]);
  const drag=useRef<DragState|null>(null);
  const [dragId,setDragId]=useState<string|null>(null);
  const [hover,setHover]=useState<SpellZone|null>(null);
  const [menu,setMenu]=useState<MenuState|null>(null);
  const inZone=(zone:SpellZone)=>spellZoneRows(rows,zone);
  const move=(id:string,target:SpellZone,anchorId?:string,after=false)=>{
    if(disabled)return;
    onSave(moveSpellLayout(spells,raw,id,target,anchorId,after));
  };
  const addDivider=(zone:SpellZone,anchorId?:string)=>{
    if(disabled)return;
    const id='divider:'+(typeof crypto!=='undefined'&&'randomUUID' in crypto
      ?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    onSave(addSpellDivider(spells,raw,zone,id,anchorId));
    setMenu(null);
  };
  const renameDivider=(id:string,title:string)=>{
    if(disabled)return;
    onSave(setSpellDividerTitle(raw,id,title));
  };
  const removeDivider=(id:string)=>{
    if(disabled)return;
    onSave(deleteSpellDivider(raw,id));
    setMenu(null);
  };
  const pointerDown=(event:PointerEvent<HTMLButtonElement>,id:string)=>{
    if(disabled||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    drag.current={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove=(event:PointerEvent<HTMLButtonElement>)=>{
    const state=drag.current;
    if(!state||state.pointerId!==event.pointerId)return;
    if(Math.hypot(event.clientX-state.x,event.clientY-state.y)<7&&!dragId)return;
    if(dragId!==state.id)setDragId(state.id);
    setHover(detectDrop(event.clientX,event.clientY)?.zone??null);
  };
  const finish=()=>{
    drag.current=null;
    setDragId(null);
    setHover(null);
  };
  const pointerUp=(event:PointerEvent<HTMLButtonElement>)=>{
    const state=drag.current;
    if(!state||state.pointerId!==event.pointerId)return;
    const wasDragged=Math.hypot(event.clientX-state.x,event.clientY-state.y)>=7;
    const destination=wasDragged?detectDrop(event.clientX,event.clientY):null;
    finish();
    if(destination)move(state.id,destination.zone,destination.anchorId,destination.after);
  };
  const pointerCancel=()=>finish();
  const keyboardMove=(event:KeyboardEvent<HTMLButtonElement>,id:string)=>{
    if(disabled||!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const item=rows.find(row=>row.id===id);
    if(!item)return;
    const same=inZone(item.zone),index=same.findIndex(row=>row.id===id);
    if(event.key==='ArrowUp'&&index>0)move(id,item.zone,same[index-1].id);
    if(event.key==='ArrowDown'&&index>=0&&index<same.length-1)
      move(id,item.zone,same[index+1].id, true);
  };
  const context=(event:MouseEvent<HTMLElement>,zone:SpellZone)=>{
    if(disabled)return;
    if(event.target instanceof Element&&event.target.closest('input,textarea'))return;
    event.preventDefault();event.stopPropagation();
    const rowEl=event.target instanceof Element
      ?event.target.closest<HTMLElement>('[data-pf-spell-row]'):null;
    setMenu({zone,x:Math.min(event.clientX,Math.max(8,window.innerWidth-230)),
      y:Math.min(event.clientY,Math.max(8,window.innerHeight-135)),
      rowId:rowEl?.dataset.pfSpellRow});
  };
  useEffect(()=>{
    if(!menu)return;
    const outside=(event:globalThis.PointerEvent)=>{
      if(!(event.target instanceof Element)||!event.target.closest('.pf-spell-context-menu'))
        setMenu(null);
    };
    const escape=(event:globalThis.KeyboardEvent)=>{
      if(event.key==='Escape')setMenu(null);
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
    };
  },[menu]);
  const contextMenu:ReactNode=menu?createPortal(
    <div className="pf-spell-context-menu" role="menu"
      aria-label="Действия со списком заклинаний"
      style={{left:menu.x,top:menu.y}}>
      <button type="button" role="menuitem" onClick={()=>addDivider(menu.zone,menu.rowId)}>
        <Plus size={14}/> {menu.rowId?'Разделитель после':'Добавить разделитель'}
      </button>
      {rows.some(row=>row.id===menu.rowId&&row.kind==='divider')&&
        <button type="button" role="menuitem" onClick={()=>removeDivider(menu.rowId!)}>
          <X size={14}/> Удалить разделитель
        </button>}
      <button type="button" role="menuitem" onClick={()=>setMenu(null)}>Отмена</button>
    </div>,document.body):null;
  return {
    rows,inZone,dragId,hover,contextMenu,addDivider,renameDivider,removeDivider,
    pointerDown,pointerMove,pointerUp,pointerCancel,keyboardMove,context,
  };
}
export type SpellLayoutUi=ReturnType<typeof useSpellLayoutUi>;

export function SpellDragHandle({row,layout,disabled=false}:{
  row:SpellLayoutRow;layout:SpellLayoutUi;disabled?:boolean;
}){
  return <button type="button" className="pf-spell-drag-handle"
    disabled={disabled} aria-label={'Перетащить '+(row.kind==='spell'?row.spell?.name??'заклинание':'разделитель')}
    title="Перетащить в другой раздел (Alt + ↑/↓ — поменять порядок)"
    onPointerDown={e=>layout.pointerDown(e,row.id)}
    onPointerMove={layout.pointerMove} onPointerUp={layout.pointerUp}
    onPointerCancel={layout.pointerCancel}
    onKeyDown={e=>layout.keyboardMove(e,row.id)}>
    <GripVertical size={14} aria-hidden="true"/>
  </button>;
}

export function SpellDivider({row,layout,disabled=false}:{
  row:SpellLayoutRow;layout:SpellLayoutUi;disabled?:boolean;
}){
  if(row.kind!=='divider')return null;
  return <div className="pf-spell-divider" data-pf-spell-row={row.id}>
    <SpellDragHandle row={row} layout={layout} disabled={disabled}/>
    <input type="text" value={row.title} maxLength={120} disabled={disabled}
      aria-label="Название разделителя" placeholder="Название разделителя"
      onChange={event=>layout.renameDivider(row.id,event.target.value)}/>
    <button type="button" className="pf-spell-divider-remove"
      aria-label="Удалить разделитель" title="Удалить разделитель" disabled={disabled}
      onClick={()=>layout.removeDivider(row.id)}><X size={12}/></button>
  </div>;
}

export function SpellDividerAdd({zone,layout,disabled=false}:{
  zone:SpellZone;layout:SpellLayoutUi;disabled?:boolean;
}){
  return <button type="button" className="pf-spell-divider-add" disabled={disabled}
    title="Добавить разделитель с подписью (также доступно по правому клику)"
    onClick={()=>layout.addDivider(zone)}><Plus size={11}/> Разделитель</button>;
}

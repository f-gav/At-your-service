import {useEffect,useRef,useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent,PointerEvent as ReactPointerEvent} from 'react';
import {GripVertical,MoveDiagonal2,X} from 'lucide-react';
import {
  clampNavigationRect,initialNavigationRect,moveNavigationRect,
  parseNavigationRect,resizeNavigationRect,
} from './floating-navigation-geometry';
import type {NavigationRect,NavigationViewport} from './floating-navigation-geometry';
import './FloatingPageNavigation.css';

type PageLink<Page extends string>={id:Page;label:string};
type Props<Page extends string>={
  system:'pf2e'|'prmoon';
  pages:readonly PageLink<Page>[];
  activePage:Page;
  onNavigate:(page:Page)=>void;
  onClose:()=>void;
};
type Gesture={pointerId:number;kind:'move'|'resize';x:number;y:number;origin:NavigationRect};
const viewport=():NavigationViewport=>({
  width:Math.max(1,window.innerWidth),
  height:Math.max(1,window.innerHeight),
});
const sameRect=(a:NavigationRect,b:NavigationRect)=>
  a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;

/** UI-only settings: position/size are never written into the character sheet or PDF. */
export default function FloatingPageNavigation<Page extends string>({
  system,pages,activePage,onNavigate,onClose,
}:Props<Page>){
  const storageKey='ays-floating-pages-v1-'+system;
  const [rect,setRect]=useState<NavigationRect>(()=>{
    let saved:string|null=null;
    try{saved=window.localStorage.getItem(storageKey);}catch{/* Browser may block storage. */}
    return parseNavigationRect(saved,viewport())??initialNavigationRect(viewport(),pages.length);
  });
  const rectRef=useRef(rect);
  const gesture=useRef<Gesture|null>(null);
  rectRef.current=rect;

  function persist(value:NavigationRect){
    try{window.localStorage.setItem(storageKey,JSON.stringify(value));}
    catch{/* Keep on-screen navigation functional when storage is unavailable. */}
  }
  useEffect(()=>{
    const clampToViewport=()=>{
      const next=clampNavigationRect(rectRef.current,viewport());
      if(!sameRect(next,rectRef.current)){
        rectRef.current=next;setRect(next);persist(next);
      }
    };
    window.addEventListener('resize',clampToViewport);
    return()=>window.removeEventListener('resize',clampToViewport);
  },[storageKey]);

  function start(event:ReactPointerEvent<HTMLElement>,kind:Gesture['kind']){
    if(event.button!==0 || (kind==='move'&&(event.target as HTMLElement).closest('button')))return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current={pointerId:event.pointerId,kind,x:event.clientX,y:event.clientY,origin:rectRef.current};
  }
  function pointerMove(event:ReactPointerEvent<HTMLElement>){
    const active=gesture.current;
    if(!active||active.pointerId!==event.pointerId)return;
    const dx=event.clientX-active.x,dy=event.clientY-active.y;
    const next=active.kind==='move'
      ?moveNavigationRect(active.origin,dx,dy,viewport())
      :resizeNavigationRect(active.origin,dx,dy,viewport());
    rectRef.current=next;
    setRect(next);
  }
  function finish(event:ReactPointerEvent<HTMLElement>){
    if(gesture.current?.pointerId!==event.pointerId)return;
    gesture.current=null;
    persist(rectRef.current);
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function arrows(event:ReactKeyboardEvent<HTMLElement>,kind:Gesture['kind']){
    const directions:Record<string,[number,number]>={
      ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
    };
    const direction=directions[event.key];
    if(!direction || event.target!==event.currentTarget)return;
    event.preventDefault();
    const step=event.shiftKey?1:12;
    const next=kind==='move'
      ?moveNavigationRect(rectRef.current,direction[0]*step,direction[1]*step,viewport())
      :resizeNavigationRect(rectRef.current,direction[0]*step,direction[1]*step,viewport());
    rectRef.current=next;setRect(next);persist(next);
  }

  return <nav className="pf-navigation-help" aria-label="Быстрая навигация по листу"
    style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}}>
    <div className="pf-navigation-help-title" tabIndex={0}
      aria-label="Переместить меню страниц клавишами со стрелками"
      title="Перетащите для перемещения · стрелки — переместить · Shift — точнее"
      onPointerDown={event=>start(event,'move')} onPointerMove={pointerMove}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={event=>arrows(event,'move')}>
      <GripVertical size={14} aria-hidden="true" className="pf-navigation-drag-icon"/>
      <span>Страницы</span>
      <button type="button" onClick={onClose} aria-label="Скрыть помощь в навигации"
        title="Скрыть меню страниц"><X size={14}/></button>
    </div>
    <div className="pf-navigation-help-items">
      {pages.map((page,index)=><button key={page.id} type="button"
        className={`pf-navigation-help-link${activePage===page.id?' pf-navigation-help-active':''}`}
        onClick={()=>onNavigate(page.id)}
        aria-label={`Страница ${index+1}: ${page.label}`}
        aria-current={activePage===page.id?'page':undefined} title={page.label}>
        <span className="pf-navigation-help-number">{index+1}</span>
        <span className="pf-navigation-help-label">{page.label}</span>
      </button>)}
    </div>
    <button type="button" className="pf-navigation-help-resize"
      data-side={rect.x+rect.width/2>=viewport().width/2?'left':'right'}
      aria-label="Изменить размер меню страниц клавишами со стрелками"
      title="Перетащите, чтобы изменить размер · стрелки — изменить размер"
      onPointerDown={event=>start(event,'resize')} onPointerMove={pointerMove}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={event=>arrows(event,'resize')}>
      <MoveDiagonal2 size={14} aria-hidden="true"/>
    </button>
  </nav>;
}

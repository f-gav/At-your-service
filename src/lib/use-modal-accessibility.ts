import {useEffect,useRef} from 'react';

/** Shared keyboard and scroll behavior for application dialogs.
 * No changes to data, navigation, or the contents of the dialog.
 * A single topmost application modal is expected at a time.
 */
export function useModalAccessibility(
  open:boolean,onRequestClose:()=>void,locked=false,
):void {
  const closeRef=useRef(onRequestClose);
  const lockedRef=useRef(locked);
  closeRef.current=onRequestClose;
  lockedRef.current=locked;
  useEffect(()=>{
    if(!open)return;
    const dialogs=Array.from(document.querySelectorAll<HTMLElement>(
      '[role="dialog"][aria-modal="true"]'));
    const dialog=dialogs.at(-1);
    if(!dialog)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    const selectFocusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(element=>element.getClientRects().length>0);
    document.body.style.overflow='hidden';
    const initial=dialog.querySelector<HTMLElement>('[autofocus]')??selectFocusable()[0]??dialog;
    if(initial===dialog&&!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;
    initial.focus({preventScroll:true});
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        if(!lockedRef.current){event.preventDefault();event.stopPropagation();closeRef.current();}
        return;
      }
      if(event.key!=='Tab')return;
      const focusable=selectFocusable();
      if(!focusable.length){event.preventDefault();dialog.focus({preventScroll:true});return;}
      const first=focusable[0],last=focusable.at(-1)!;
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
        event.preventDefault();last.focus({preventScroll:true});
      }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
        event.preventDefault();first.focus({preventScroll:true});
      }
    };
    document.addEventListener('keydown',handleKey,true);
    return()=>{
      document.removeEventListener('keydown',handleKey,true);
      document.body.style.overflow=previousOverflow;
      if(previous?.isConnected)previous.focus({preventScroll:true});
    };
  },[open]);
}

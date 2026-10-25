/** Compute the rich-text floating toolbar position inside the visible viewport.
 * Native mobile selection overlays typically occupy space above the selection;
 * place our toolbar below it and never behind the on-screen keyboard.
 */
type Rect = {left:number;top:number;bottom:number;width:number};
type Viewport = {width:number;height:number;offsetLeft:number;offsetTop:number};
export function richToolbarPosition(rect:Rect,viewport:Viewport,mobile:boolean){
  const width=Math.min(370,Math.max(0,viewport.width-16));
  const left=Math.max(viewport.offsetLeft+8,Math.min(
    viewport.offsetLeft+viewport.width-width-8,
    rect.left+rect.width/2-width/2,
  ));
  const minTop=viewport.offsetTop+8;
  const maxTop=Math.max(minTop,viewport.offsetTop+viewport.height-48);
  const wanted=mobile?rect.bottom+10:rect.top-57;
  return {left,top:Math.max(minTop,Math.min(maxTop,wanted))};
}

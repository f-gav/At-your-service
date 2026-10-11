/** Position the insertion toolbar beside the actual caret rather than the
 * bottom of an entire tall multiline field. Geometry is in viewport pixels.
 */
export type CaretBox={left:number;top:number;bottom:number;height:number};
export type CursorPoint={x:number;y:number};
export function insertionMenuPosition(
  caret:CaretBox, line:CaretBox, viewport:{width:number;height:number},
  pointer:CursorPoint|null=null,
):{left:number;top:number}{
  const margin=8,menuWidth=370,menuHeight=42;
  const hasCaret=caret.height>0&&caret.bottom>=caret.top;
  const anchorX=hasCaret?caret.left:pointer?.x??line.left;
  // A contentEditable with only a <br> may report a zero-height caret rect.
  // The fallback is the clicked position or the *first line*, never box.height.
  const bottom=hasCaret?caret.bottom:pointer?.y??line.top+Math.min(24,Math.max(16,line.height));
  const left=Math.max(margin,Math.min(viewport.width-menuWidth-margin,anchorX));
  const wanted=bottom+6;
  const top=wanted+menuHeight+margin<=viewport.height?wanted:Math.max(margin,(hasCaret?caret.top:bottom)-menuHeight-6);
  return {left:Math.max(margin,left),top};
}

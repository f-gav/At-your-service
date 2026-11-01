/**
 * Floating page-navigation coordinates are viewport pixels, not character
 * fields. Keeping this logic pure makes desktop/mobile clamping testable.
 */
export type NavigationRect = {x:number;y:number;width:number;height:number};
export type NavigationViewport = {width:number;height:number};
const MARGIN=8;
const MIN_WIDTH=44;
const MIN_HEIGHT=104;
const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,min),max);

export function clampNavigationRect(rect:NavigationRect,viewport:NavigationViewport):NavigationRect {
  const usableWidth=Math.max(1,Math.floor(viewport.width)-MARGIN*2);
  const usableHeight=Math.max(1,Math.floor(viewport.height)-MARGIN*2);
  const width=clamp(Number.isFinite(rect.width)?rect.width:MIN_WIDTH,Math.min(MIN_WIDTH,usableWidth),usableWidth);
  const height=clamp(Number.isFinite(rect.height)?rect.height:MIN_HEIGHT,Math.min(MIN_HEIGHT,usableHeight),usableHeight);
  return {
    x:clamp(Number.isFinite(rect.x)?rect.x:MARGIN,MARGIN,Math.max(MARGIN,viewport.width-MARGIN-width)),
    y:clamp(Number.isFinite(rect.y)?rect.y:MARGIN,MARGIN,Math.max(MARGIN,viewport.height-MARGIN-height)),
    width,height,
  };
}
export function initialNavigationRect(viewport:NavigationViewport,pageCount:number):NavigationRect {
  const compact=viewport.width<=760?38:viewport.width<=1240?43:226;
  const width=Math.min(compact,Math.max(MIN_WIDTH,viewport.width-MARGIN*2));
  const height=Math.min(viewport.height-MARGIN*2,Math.max(170,pageCount*40+75));
  return clampNavigationRect({
    x:viewport.width-width-(compact<100?5:16),
    y:(viewport.height-height)/2,width,height,
  },viewport);
}
export function moveNavigationRect(rect:NavigationRect,dx:number,dy:number,viewport:NavigationViewport):NavigationRect {
  return clampNavigationRect({...rect,x:rect.x+dx,y:rect.y+dy},viewport);
}
export function resizeNavigationRect(rect:NavigationRect,dx:number,dy:number,viewport:NavigationViewport):NavigationRect {
  const availableWidth=Math.max(1,viewport.width-MARGIN-rect.x);
  const availableHeight=Math.max(1,viewport.height-MARGIN-rect.y);
  // When the menu is docked near the right edge, grow it *to the left*.
  // Otherwise a right-bottom resize handle would be pinned against the screen.
  const fromLeft=rect.x+rect.width/2>=viewport.width/2;
  const fixedRight=rect.x+rect.width;
  const maxWidth=fromLeft?Math.max(1,fixedRight-MARGIN):availableWidth;
  const width=clamp(rect.width+(fromLeft?-dx:dx),Math.min(MIN_WIDTH,maxWidth),maxWidth);
  return clampNavigationRect({
    ...rect,
    x:fromLeft?fixedRight-width:rect.x,
    width,
    height:clamp(rect.height+dy,Math.min(MIN_HEIGHT,availableHeight),availableHeight),
  },viewport);
}
export function parseNavigationRect(raw:string|null,viewport:NavigationViewport):NavigationRect|null {
  if(!raw)return null;
  try{
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const rect=value as Record<string,unknown>;
    if(['x','y','width','height'].some(k=>typeof rect[k]!=='number'||!Number.isFinite(rect[k])))return null;
    return clampNavigationRect({
      x:rect.x as number,y:rect.y as number,
      width:rect.width as number,height:rect.height as number,
    },viewport);
  }catch{return null;}
}

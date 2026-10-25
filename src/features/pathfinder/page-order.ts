/** User-configured PF2e page presentation, stored in ordinary character
 * sheet values. Original PDF field/page IDs remain immutable.
 *
 * The optional notes page stays in the order even when hidden. Neither hiding
 * the page nor moving any page deletes its content or changes its field IDs.
 */
export const PF_PAGE_ORDER_KEY='pf2e_page_order';
export const PF_NOTES_ENABLED_KEY='pf2e_notes_enabled';
export const PF_HIDDEN_PAGES_KEY='pf2e_hidden_pages';
export const PF_NOTES_CONTENT_KEY='pf2e_notes_content';

export const PAGE_IDS=['1','2','3','4','notes'] as const;
export type PfPageId=typeof PAGE_IDS[number];
export const DEFAULT_PAGE_ORDER:PfPageId[]=[...PAGE_IDS];
export const PAGE_LABELS:Record<PfPageId,string>={
  '1':'Характеристики',
  '2':'Способности и снаряжение',
  '3':'Заметки и действия',
  '4':'Заклинания',
  notes:'Заметки',
};
const known=new Set<string>(PAGE_IDS);
export function isPfPageId(value:string):value is PfPageId {
  return known.has(value);
}
export function parsePageOrder(raw:unknown):PfPageId[]{
  if(typeof raw!=='string')return [...PAGE_IDS];
  const ordered:PfPageId[]=[];
  for(const id of raw.split(',')){
    const clean=id.trim();
    if(isPfPageId(clean)&&!ordered.includes(clean))ordered.push(clean);
  }
  // Adding newly introduced pages to the tail keeps old custom orders usable.
  for(const id of PAGE_IDS)if(!ordered.includes(id))ordered.push(id);
  return ordered;
}
export function visiblePageOrder(order:readonly PfPageId[],notesEnabled:boolean,hidden:readonly PfPageId[]=[]):PfPageId[]{
  const canonical=parsePageOrder(order.join(','));
  return canonical.filter(id=>(notesEnabled||id!=='notes')&&!hidden.includes(id));
}
export function movePage(order:readonly PfPageId[],source:PfPageId,destination:PfPageId):PfPageId[]{
  const ids=parsePageOrder(order.join(','));
  const sourceIndex=ids.indexOf(source),destinationIndex=ids.indexOf(destination);
  if(sourceIndex<0||destinationIndex<0||sourceIndex===destinationIndex)return ids;
  ids.splice(sourceIndex,1);
  ids.splice(destinationIndex,0,source);
  return ids;
}
export function shiftVisiblePage(order:readonly PfPageId[],source:PfPageId,delta:-1|1,notesEnabled:boolean):PfPageId[]{
  const visible=visiblePageOrder(order,notesEnabled);
  const i=visible.indexOf(source);
  if(i<0||i+delta<0||i+delta>=visible.length)return parsePageOrder(order.join(','));
  // Move relative to the adjacent visible page; a hidden notes page always
  // keeps its place in the underlying order.
  return movePage(order,source,visible[i+delta]);
}
export function serializePageOrder(order:readonly PfPageId[]):string{
  return parsePageOrder(order.join(',')).join(',');
}
export function notesPageEnabled(value:unknown):boolean{
  return value===true||value==='true';
}

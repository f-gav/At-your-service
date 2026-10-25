/** Visibility is a view preference, never a deletion or a page reorder.
 * Hidden pages retain all their saved fields and their original order.
 */
export function parseHiddenPageIds<Page extends string>(raw:unknown,known:readonly Page[]):Page[]{
  const values=Array.isArray(raw)?raw:typeof raw==='string'?raw.split(','):[];
  const knownIds=new Set<string>(known);
  return [...new Set(values.filter((id):id is Page=>typeof id==='string'&&knownIds.has(id)))];
}
export function visiblePageIds<Page extends string>(order:readonly Page[],hidden:readonly Page[]):Page[]{
  const ids=new Set(hidden);
  return order.filter(page=>!ids.has(page));
}
export function setPageVisible<Page extends string>(
  available:readonly Page[], hidden:readonly Page[], page:Page, visible:boolean,
):Page[]{
  if(!available.includes(page))return [...hidden];
  const current=hidden.filter(id=>available.includes(id));
  if(visible)return current.filter(id=>id!==page);
  if(current.includes(page))return current;
  // Keep at least one page accessible; all others can be restored in settings.
  if(visiblePageIds(available,current).length<=1)return current;
  return [...current,page];
}

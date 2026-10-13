export type SiteRoute = {kind:'characters'} | {kind:'library'} | {kind:'character';id:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseSiteRoute(hash:string):SiteRoute {
  const route=hash.replace(/^#/,'').replace(/^\/+|\/+$/g,'');
  if(route==='library')return {kind:'library'};
  const match=/^character\/([^/]+)$/.exec(route);
  if(match && UUID.test(match[1]))return {kind:'character',id:match[1]};
  return {kind:'characters'};
}
export function siteRouteHash(route:SiteRoute):string {
  return route.kind==='library'?'#library':route.kind==='character'?'#character/'+route.id:'#characters';
}

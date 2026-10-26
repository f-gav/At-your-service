export type SiteRoute = {kind:'characters'} | {kind:'library'} | {kind:'rooms'} | {kind:'character';id:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseSiteRoute(path:string,base='/'):SiteRoute {
  const relative=path.startsWith(base)?path.slice(base.length):path;
  const route=relative.replace(/^#/,'').replace(/^\/+|\/+$/g,'');
  if(route==='library')return {kind:'library'};
  if(route==='rooms')return {kind:'rooms'};
  const match=/^character\/([^/]+)$/.exec(route);
  if(match && UUID.test(match[1]))return {kind:'character',id:match[1]};
  return {kind:'characters'};
}
export function siteRoutePath(route:SiteRoute,base='/'):string {
  const root=base.replace(/\/?$/,'/');
  return root+(route.kind==='library'?'library/':route.kind==='rooms'?'rooms/':route.kind==='character'?'character/'+route.id+'/':'');
}
export function currentSiteRoute():SiteRoute {
  return parseSiteRoute(window.location.pathname,import.meta.env.BASE_URL);
}
export function initializeSiteRoute():void {
  const base=import.meta.env.BASE_URL;
  const url=new URL(window.location.href);
  const redirected=url.searchParams.get('__route');
  if(redirected){
    const target=new URL(redirected,url.origin);
    if(target.origin===url.origin&&target.pathname.startsWith(base)){
      window.history.replaceState(null,'',target.pathname+target.search+target.hash);
    }
  }
  // Keep existing bookmarks working without interpreting OAuth fragments as routes.
  if(/^#(?:library|rooms|characters|character\/[0-9a-f-]+)\/?$/i.test(window.location.hash)){
    const route=parseSiteRoute(window.location.hash);
    window.history.replaceState(null,'',siteRoutePath(route,base)+window.location.search);
  }
}

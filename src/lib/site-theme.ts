/** Site appearance is a browser preference, never part of character data. */
export const SITE_THEME_KEY='ays-site-theme';
export type SiteTheme='light'|'dark';

export function readSiteTheme():SiteTheme {
  try { return window.localStorage.getItem(SITE_THEME_KEY)==='dark'?'dark':'light'; }
  catch { return 'light'; }
}

export function applySiteTheme(theme:SiteTheme):void {
  document.documentElement.dataset.aysTheme=theme;
  const color=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if(color)color.content=theme==='dark'?'#0d0f15':'#f7f7f5';
}

export function saveSiteTheme(theme:SiteTheme):void {
  applySiteTheme(theme);
  try { window.localStorage.setItem(SITE_THEME_KEY,theme); }
  catch { /* Appearance remains usable if storage is unavailable. */ }
}

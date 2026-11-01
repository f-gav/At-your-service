import {DEFAULT_SPELL_FILTERS,filterSpellViews,toSpellViews} from './catalog';
import type {SpellCatalog,SpellFilters,SpellSystem,SpellView,SpellKind} from './catalog';
import {loadCachedSpellCatalog} from './cached-catalog';
export type LibrarySection='all'|SpellKind|'mine';
export const RESULTS_PER_PAGE=50;
export async function loadSpellLibraryCatalog(system:SpellSystem,signal:AbortSignal,basePath:string){
 return loadCachedSpellCatalog(system,signal,basePath);
}
export function librarySpellViews(catalog:SpellCatalog,edition:string){return toSpellViews(catalog,edition);}
export function filterLibrarySpells(views:SpellView[],filters:SpellFilters,section:LibrarySection,system:SpellSystem){
 if(section==='mine')return [];
 const kind=section==='all'||section==='mine'||(system==='dnd5e'&&section==='ritual')?'all':section;
 const matches=filterSpellViews(views,{...filters,kind});
 return system==='dnd5e'&&section==='ritual'?matches.filter(entry=>entry.rules.ritual===true||entry.spell.kind==='ritual'):matches;
}
export function sourceFilteredSpells(visible:SpellView[],source:string){
 return source==='all'?visible:visible.filter(entry=>entry.source?.name===source);
}
export function paginateLibrarySpells(visible:SpellView[],count:number){return visible.slice(0,count);}
export function hasLibraryFilters(filters:SpellFilters,source:string,section:LibrarySection){
 return filters.query!==''||filters.rank!=='all'||filters.tradition!=='all'||filters.className!=='all'||filters.school!=='all'||filters.rarity!=='all'||filters.locale!=='all'||source!=='all'||(section!=='all'&&section!=='mine');
}
export {DEFAULT_SPELL_FILTERS};

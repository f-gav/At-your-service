import {parseSpellCatalog} from './catalog.ts';
import type {SpellCatalog,SpellSystem} from './catalog';

/** Shared spell catalog loader for library and character grimoire. */
export async function loadSpellCatalog(
  system:SpellSystem,
  signal:AbortSignal,
  basePath:string,
  fetcher:typeof fetch=fetch,
):Promise<SpellCatalog>{
  const root=basePath.replace(/\/?$/, '/')+'spell-library/';
  const read=async(file:string)=>{
    const response=await fetcher(root+file,{signal});
    if(!response.ok)throw new Error('Не удалось загрузить '+file+': HTTP '+response.status);
    return parseSpellCatalog(await response.json(),system);
  };
  const base=await read(system+'.json');
  if(system!=='pf2e')return base;
  const necro=await read('pf2e-necromancer.json');
  const check=(kind:string,baseIds:string[],extraIds:string[])=>{
    const existing=new Set(baseIds);
    if(extraIds.some(id=>existing.has(id))||new Set(extraIds).size!==extraIds.length)
      throw new Error('Повторяющиеся '+kind+' в каталоге заклинаний');
  };
  check('заклинания',base.spells.map(x=>x.id),necro.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),necro.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),necro.sources.map(x=>x.id));
  base.spells.push(...necro.spells);
  base.versions.push(...necro.versions);
  base.translations.push(...necro.translations);
  base.sources.push(...necro.sources);
  return base;
}

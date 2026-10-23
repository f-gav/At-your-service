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
  // Class packs are additive and loaded by both the Library and the character Grimoire.
  // Keep this file for wave 2/3 even as the class's catalogue grows.
  const cleric=await read('pf2e-cleric-wave1.json');
  check('заклинания',base.spells.map(x=>x.id),cleric.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),cleric.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),cleric.sources.map(x=>x.id));
  base.spells.push(...cleric.spells);
  base.versions.push(...cleric.versions);
  base.translations.push(...cleric.translations);
  base.sources.push(...cleric.sources);
  const clericWave1b=await read('pf2e-cleric-wave1b.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave1b.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave1b.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave1b.sources.map(x=>x.id));
  base.spells.push(...clericWave1b.spells);
  base.versions.push(...clericWave1b.versions);
  base.translations.push(...clericWave1b.translations);
  base.sources.push(...clericWave1b.sources);
  return base;
}

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
  const clericWave1c=await read('pf2e-cleric-wave1c.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave1c.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave1c.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave1c.sources.map(x=>x.id));
  base.spells.push(...clericWave1c.spells);
  base.versions.push(...clericWave1c.versions);
  base.translations.push(...clericWave1c.translations);
  base.sources.push(...clericWave1c.sources);
  const clericWave1d=await read('pf2e-cleric-wave1d.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave1d.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave1d.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave1d.sources.map(x=>x.id));
  base.spells.push(...clericWave1d.spells);
  base.versions.push(...clericWave1d.versions);
  base.translations.push(...clericWave1d.translations);
  base.sources.push(...clericWave1d.sources);
  const clericWave1e=await read('pf2e-cleric-wave1e.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave1e.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave1e.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave1e.sources.map(x=>x.id));
  base.spells.push(...clericWave1e.spells);
  base.versions.push(...clericWave1e.versions);
  base.translations.push(...clericWave1e.translations);
  base.sources.push(...clericWave1e.sources);
  // Cleric second wave: each class-only pack remains separate and additive.
  const clericWave2a=await read('pf2e-cleric-wave2a.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave2a.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave2a.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave2a.sources.map(x=>x.id));
  base.spells.push(...clericWave2a.spells);
  base.versions.push(...clericWave2a.versions);
  base.translations.push(...clericWave2a.translations);
  base.sources.push(...clericWave2a.sources);
  const clericWave2b=await read('pf2e-cleric-wave2b.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave2b.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave2b.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave2b.sources.map(x=>x.id));
  base.spells.push(...clericWave2b.spells);
  base.versions.push(...clericWave2b.versions);
  base.translations.push(...clericWave2b.translations);
  base.sources.push(...clericWave2b.sources);
  const clericWave2c=await read('pf2e-cleric-wave2c.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave2c.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave2c.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave2c.sources.map(x=>x.id));
  base.spells.push(...clericWave2c.spells);
  base.versions.push(...clericWave2c.versions);
  base.translations.push(...clericWave2c.translations);
  base.sources.push(...clericWave2c.sources);
  const clericWave2d=await read('pf2e-cleric-wave2d.json');
  check('заклинания',base.spells.map(x=>x.id),clericWave2d.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericWave2d.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericWave2d.sources.map(x=>x.id));
  base.spells.push(...clericWave2d.spells);
  base.versions.push(...clericWave2d.versions);
  base.translations.push(...clericWave2d.translations);
  base.sources.push(...clericWave2d.sources);
  // Apocryphal domain spells from Dark Archive are alternative, not replacement versions.
  const clericApocryphal1a=await read('pf2e-cleric-apocryphal-wave1a.json');
  check('заклинания',base.spells.map(x=>x.id),clericApocryphal1a.spells.map(x=>x.id));
  check('версии',base.versions.map(x=>x.id),clericApocryphal1a.versions.map(x=>x.id));
  check('источники',base.sources.map(x=>x.id),clericApocryphal1a.sources.map(x=>x.id));
  base.spells.push(...clericApocryphal1a.spells);
  base.versions.push(...clericApocryphal1a.versions);
  base.translations.push(...clericApocryphal1a.translations);
  base.sources.push(...clericApocryphal1a.sources);
  return base;
}

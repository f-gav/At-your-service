import {parseSiteRoute,siteRoutePath} from '../src/lib/routes.ts';
import {loadSpellCatalog} from '../src/features/spell-library/load-catalog.ts';
import {availableGrimoireClasses,filterGrimoireEntries} from '../src/features/pathfinder/grimoire-selectors.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,SPELL_SYSTEMS,
  emptySpellCatalog,parseSpellCatalog,toSpellViews,filterSpellViews,spellSubclassLabel,
} from '../src/features/spell-library/catalog.ts';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');

const dnd=JSON.parse(source('../public/spell-library/dnd5e.json'));
assert.deepEqual(parseSpellCatalog(dnd,'dnd5e'),emptySpellCatalog('dnd5e'),
  'D&D must remain untouched during Pathfinder waves 001–003');
const wave=JSON.parse(source('../public/spell-library/pf2e.json'));
parseSpellCatalog(wave,'pf2e');
const inkshotRu=wave.translations.find(t=>t.spellId==='pf2e-inkshot'&&t.locale==='ru');
assert.match(inkshotRu.description,/2d6/,'Inkshot must specify poison damage');
assert.match(inkshotRu.description,/бросок атаки заклинанием/,'Inkshot must state attack roll');
assert.match(inkshotRu.description,/1 раунд/,'Inkshot must specify normal hit duration');
assert.match(inkshotRu.description,/1 минуту/,'Inkshot must specify critical hit duration');
assert.equal(wave.spells.length,483,'71 cantrips + 189 rank-one + 223 rank-two spells');
assert.equal(wave.versions.length,483);
assert.equal(wave.translations.filter(t=>t.locale==='ru').length,483,'All 483 spells have main-catalog Russian translations after wave 07');
assert.equal(wave.translations.filter(t=>t.locale==='en').length,483,'Every spell retains a canonical English identity');
assert.ok(wave.spells.every(s=>s.system==='pf2e'&&((s.kind==='cantrip'&&s.rank===0)||(s.kind==='spell'&&(s.rank===1||s.rank===2)))));
assert.equal(wave.spells.filter(s=>s.kind==='cantrip').length,71);
assert.equal(wave.spells.filter(s=>s.kind==='spell'&&s.rank===1).length,189);
assert.equal(wave.spells.filter(s=>s.kind==='spell'&&s.rank===2).length,223);
assert.equal(wave.translations.filter(t=>t.locale==='en'&&wave.spells.find(s=>s.id===t.spellId)?.rank===2).length,223);
assert.equal(new Set(wave.spells.map(s=>s.id)).size,483,'Unique spell IDs');

/** All 223 rank-two cards must have human-readable Russian metadata, not
 * raw Foundry area JSON or untranslated save/target/duration values. */
const rankTwoSpellIds=new Set(wave.spells.filter(s=>s.rank===2).map(s=>s.id));
const rankTwoVersions=wave.versions.filter(v=>rankTwoSpellIds.has(v.spellId));
assert.equal(rankTwoVersions.length,223);
for(const version of rankTwoVersions){
  for(const key of ['area','savingThrow','range','targets','duration','trigger','requirements']){
    const value=version[key];
    if(typeof value==='string')assert.ok(!/[a-zA-Z{}]/.test(value),
      'Unexpected raw/English rank-two '+key+': '+version.spellId+'='+value);
  }
  if(typeof version.cast?.time==='string')assert.ok(!/[a-zA-Z]/.test(version.cast.time),
    'Unlocalized casting time: '+version.spellId);
  if(version.savingThrow)assert.match(version.savingThrow,
    /^(?:Обычный спасбросок|Спасбросок) (?:Рефлекса|Стойкости|Воли)$/,
    'Noncanonical rank-two saving throw: '+version.spellId);
}
const rankTwoRules=slug=>wave.versions.find(v=>v.spellId==='pf2e-'+slug);
assert.equal(rankTwoRules('noise-blast')?.area,'10-футовый взрыв');
assert.equal(rankTwoRules('noise-blast')?.savingThrow,'Спасбросок Стойкости');
assert.equal(rankTwoRules('paranoia')?.savingThrow,'Спасбросок Воли');
assert.equal(rankTwoRules('paranoia')?.targets,'1 существо');
assert.equal(rankTwoRules('sudden-bolt')?.savingThrow,'Обычный спасбросок Рефлекса');
assert.equal(rankTwoRules('pyrefowl-rebuke')?.savingThrow,'Обычный спасбросок Рефлекса');
assert.equal(rankTwoRules('bee-man-s-summons')?.area,'500-футовая эманация');
assert.ok(rankTwoRules('propulsive-breeze')?.trigger?.includes('Союзник'));
assert.ok(rankTwoRules('pyrefowl-rebuke')?.trigger?.includes('Ударом'));
assert.equal(rankTwoRules('summoners-precaution')?.requirements,'У вас есть эйдолон.');
assert.equal(rankTwoRules('restoration')?.cast?.time,'1 минута');
assert.equal(rankTwoRules('sudden-blight')?.savingThrow,'Обычный спасбросок Стойкости');

assert.deepEqual(wave.spells.map(s=>s.slug).slice(0,3),['acid-splash','ancient-dust','approximate']);
assert.equal(wave.spells[23].slug,'glamorize');
assert.equal(wave.spells[24].slug,'glass-shield');
assert.equal(wave.spells[47].slug,'read-aura');
assert.equal(wave.spells[48].slug,'read-the-air');
assert.equal(wave.spells[70].slug,'wash-your-luck');
assert.equal(wave.spells[71].slug,'500-toads');
assert.equal(wave.spells[258].slug,'wooden-fists');
assert.equal(wave.spells[281].slug,'blood-runs-cold');
assert.deepEqual(wave.spells.slice(239,259).map(s=>s.slug),[
  'swampcall','synchronize-steps','synchronize','tailwind','temporary-tool',
  'tether','thicket-of-knives','thoughtful-gift','threefold-limb','thunderstrike',
  'turnip-lantern','unbroken-panoply','vanishing-tracks','ventriloquism','verdant-sprout',
  'verminous-lure','wall-of-shrubs','weaken-earth','weave-wood','wooden-fists'
], 'Exact final 20 rank-one source order');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-turnip-lantern')?.duration,'1 минута',
  'Turnip Lantern duration must not be mistaken for a target');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-turnip-lantern')?.targets,undefined);
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-temporary-tool')?.cast?.time,'1 минута');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-thunderstrike')?.cast?.actions,2);

const englishOnly=[
  "ancient-dust",
  "approximate",
  "artistic-recollection",
  "bramble-bush",
  "caustic-blast",
  "create-earthen-facsimile",
  "frosts-touch",
  "ghost-sound",
  "glamorize",
  "glass-shield",
  "glowing-trail",
  "illuminate",
  "infectious-enthusiasm",
  "inside-ropes",
  "invoke-true-name",
  "join-pasts",
  "know-the-way",
  "live-wire",
  "musical-accompaniment",
  "root-reading",
  "take-root",
  "timber",
  "torturous-trauma",
  "500-toads",
  "admonishing-ray",
  "airburst",
  "aqueous-blast",
  "armor-of-thorn-and-claw",
  "benediction",
  "beseech-the-sphinx",
  "blessing-of-vigor",
  "bone-shield",
  "breathe-fire",
  "briny-bolt",
  "buffeting-winds",
  "buoyant-bubbles",
  "camel-spit",
  "carryall",
  "celestial-accord",
  "chilling-spray",
  "cinder-scribe",
  "cleanse-cuisine",
  "concordant-choir",
  "conductive-weapon",
  "connective-current",
  "cradle-aloft",
  "curse-of-recoil",
  "curse-of-slippery-steps",
  "cycle-of-retribution",
  "decompose",
  "defended-by-spirits",
  "dehydrate",
  "devils-horseshoe",
  "disguise-magic",
  "dome-of-tranquility",
  "draw-ire",
  "déjà-vu",
  "echoing-weapon",
  "elysian-whimsy",
  "equal-footing",
  "exchange-image",
  "fashionista",
  "fated-healing",
  "fishing-spot",
  "flashy-disappearance",
  "flense",
  "flourishing-flora",
  "foraging-friends",
  "forced-mercy",
  "forge",
  "friendfetch",
  "gentle-landing",
  "gloom-mantle",
  "gravitational-pull",
  "gritty-wheeze",
  "groom-companion",
  "helpful-steps",
  "hippocampus-retreat",
  "imprint-message",
  "infuse-vitality",
  "inkshot",
  "instant-pottery",
  "interposing-earth",
  "invisible-item",
  "juvenile-companion",
  "kinetic-ram",
  "know-location",
  "leaden-steps",
  "malediction",
  "message-rune",
  "metal-merged",
  "mystic-armor",
  "negate-aroma",
  "nettleskin",
  "noxious-vapors",
  "object-reading",
  "overselling-flourish",
  "penumbral-shroud",
  "personal-rain-cloud",
  "pest-form",
  "pet-cache",
  "phantasmal-minion",
  "propelling-air-stream",
  "protector-tree",
  "pummeling-rubble",
  "purifying-icicle",
  "putrefy-food-and-drink",
  "rainbows-end",
  "reed-whistle",
  "rude-awakening",
  "runic-body",
  "runic-weapon",
  "sacred-beasts",
  "scorching-blast",
  "scouring-sand",
  "seashell-of-stolen-sound",
  "shielded-arm",
  "signal-skyrocket",
  "sky-sight",
  "spirit-ward",
  "stick-on",
  "summon-lesser-servitor",
  "summon-undead",
  "synchronize-steps",
  "tailwind",
  "threefold-limb",
  "turnip-lantern",
  "unbroken-panoply",
  "vanishing-tracks",
  "verdant-sprout",
  "verminous-lure",
  "weaken-earth",
  "weave-wood",
  "wooden-fists"
];
for(const slug of englishOnly){
  const id='pf2e-'+slug;
  assert.ok(wave.translations.some(t=>t.spellId===id&&t.locale==='en'),
    'Original English identity must always be preserved: '+slug);
}
for(const t of wave.translations){
  if(t.locale==='ru'||englishOnly.some(slug=>t.spellId==='pf2e-'+slug))
    assert.ok(t.description?.length>50,'No empty spell descriptions: '+t.spellId);
}
const liveViews=toSpellViews(wave,'pf2e-remaster');
assert.equal(liveViews.length,483,'All 259 initial, 223 rank-two and 1 extra rank-one spell are searchable');
assert.equal(liveViews.filter(v=>v.locale==='ru').length,483);
assert.equal(liveViews.filter(v=>v.locale==='en').length,0);
const legacy=liveViews.filter(v=>v.rules.edition==='pf2e-legacy');
assert.deepEqual(legacy.filter(v=>v.spell.rank<=1).map(v=>v.spell.slug).sort(),["acid-splash","admonishing-ray","airburst","ancient-dust","animate-rope","aqueous-blast","buffeting-winds","celestial-accord","draw-ire","elysian-whimsy","exchange-image","fashionista","flashy-disappearance","flense","forge","friendfetch","ghost-sound","glowing-trail","gritty-wheeze","healing-plaster","helpful-steps","inkshot","inside-ropes","invoke-true-name","join-pasts","know-location","magic-stone","negate-aroma","nettleskin","overselling-flourish","personal-rain-cloud","purifying-icicle","putrefy-food-and-drink","ray-of-frost","scorching-blast","scouring-sand","shillelagh","shocking-grasp","snowball","swampcall","synchronize-steps","torturous-trauma","verdant-sprout","verminous-lure"]);
assert.equal(toSpellViews(wave,'pf2e-legacy').filter(v=>v.spell.rank<=1).length,44);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length===483);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'en'}).length===0);
assert.ok(liveViews.every(v=>wave.sources.some(src=>src.id===v.spell.sourceId)));
const electric=liveViews.find(v=>v.spell.slug==='electric-arc');
assert.ok(electric?.description.includes('2d4'),'Remaster electric arc has 2d4 base damage');
assert.ok(!electric?.description.includes('1d4 +'),'Legacy mechanics must not leak into Remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='elemental-counter')?.rules.resource,'spell-slot');
assert.equal(englishOnly.length,134,'Historical pre-translation English-only list contains 134 entries');
const tracker=source('../docs/SPELL-ENGLISH-TRACKER-RU.md');
const trackedNames=[...tracker.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map(m=>m[1]).sort();
const actualEnglishNames=liveViews.filter(v=>v.locale==='en'&&wave.spells.findIndex(s=>s.id===v.id)<259).map(v=>v.englishName).sort();
const rankTwoTracker=source('../docs/SPELL-RANK2-ENGLISH-TRACKER-RU.md');
for(const v of liveViews.filter(v=>v.locale==='en'&&v.spell.rank===2)) assert.ok(rankTwoTracker.includes('| '+v.englishName+' |'),'Rank-two English backlog must include '+v.englishName);
assert.deepEqual(trackedNames,actualEnglishNames,
  'Live English-only tracker must exactly match untranslated site cards');
const manifest=source('../docs/SPELL-WAVE-002-RU.md');
assert.ok(manifest.includes('14 с подтверждённым русским названием'));
assert.ok(manifest.includes('10 с английскими названиями'));

assert.equal(englishOnly.filter(slug=>{const i=wave.spells.findIndex(s=>s.slug===slug);return i>=24&&i<48;}).length,10,
 'Wave 002 adds ten English-only cantrips');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=24&&wave.spells.findIndex(s=>s.id===t.spellId)<48).length,24);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=48&&wave.spells.findIndex(s=>s.id===t.spellId)<71).length,23,'Every cantrip is now translated');
assert.equal(englishOnly.filter(slug=>{const n=wave.spells.findIndex(s=>s.slug===slug);return n>=48&&n<71;}).length,4,'Cantrip Wave 003 has four English-only entries');
assert.equal(liveViews.find(v=>v.spell.slug==='summon-instrument')?.rules.cast.actions,3);
assert.ok(liveViews.find(v=>v.spell.slug==='shield')?.description.includes('Твёрдостью 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='slashing-gust')?.rules.requirements?.includes('рука'));
assert.equal(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='void-warp')?.description.includes('2d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='vitality-lash')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='root-reading')?.locale==='ru');
assert.ok(liveViews.find(v=>v.spell.slug==='wash-your-luck')?.locale==='ru');
assert.ok(source('../docs/SPELL-WAVE-003-RU.md').includes('19 русских'));
assert.equal(englishOnly.filter(slug=>wave.spells.findIndex(s=>s.slug===slug)>=71).length,111,
  'Four rank-one waves contain 61 English-only cards');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=71&&wave.spells.findIndex(s=>s.id===t.spellId)<259).length,188);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:0}).length,71);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:1}).length,189);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:2}).length,223);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,kind:'spell'}).length,412);
assert.ok(liveViews.filter(v=>v.spell.rank===1).every(v=>v.rules.resource==='spell-slot'),
  'All first-rank spells spend a slot, cantrips remain cost-free');
assert.equal(liveViews.find(v=>v.spell.slug==='air-bubble')?.rules.cast?.time,'Реакция');
assert.ok(liveViews.find(v=>v.spell.slug==='air-bubble')?.rules.trigger?.includes('дышать'));
assert.equal(liveViews.find(v=>v.spell.slug==='alarm')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='breadcrumbs')?.rules.cast?.time,'1 минута');
assert.equal(liveViews.find(v=>v.spell.slug==='bane')?.rules.edition,'pf2e-remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='admonishing-ray')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='500-toads')?.spell.rarity,'rare');
assert.ok(liveViews.find(v=>v.spell.slug==='bone-shield')?.rules.requirements?.includes('рука'));
assert.ok(liveViews.find(v=>v.spell.slug==='breathe-fire')?.description.includes('урон огнём'));
assert.ok(source('../docs/SPELL-RANK1-WAVE-001-RU.md').includes('13 карточек с русскими названиями'));


assert.equal(liveViews.find(v=>v.spell.slug==='gouging-claw')?.rules.edition,'pf2e-remaster');
assert.ok(liveViews.find(v=>v.spell.slug==='gouging-claw')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='live-wire')?.description.includes('электричеством'));
assert.ok(liveViews.find(v=>v.spell.slug==='ray-of-frost')?.rules.edition==='pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='read-aura')?.rules.cast?.time,'1 минута');
assert.ok(liveViews.every(v=>v.description.length>50),'Every card retains an original or independent Russian rules summary');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&t.translatorCredit?.includes('PF2.ru, найдено через модуль')).length,3);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&t.translatorCredit?.includes('Pathfinder 2E RU Translation (Legacy')).length,0);
assert.ok(liveViews.find(v=>v.spell.slug==='mystic-armor')?.name==='Магический доспех');
assert.ok(liveViews.find(v=>v.spell.slug==='invoke-true-name')?.name==='Призыв истинного имени');
assert.ok(liveViews.find(v=>v.spell.slug==='ancient-dust')?.locale==='ru');
const briny=liveViews.find(v=>v.spell.slug==='briny-bolt');
assert.equal(briny?.name,'Солёный снаряд');
assert.equal(briny?.englishName,'Briny Bolt');
assert.equal(briny?.locale,'ru');
assert.equal(briny?.rules.edition,'pf2e-remaster');
assert.equal(briny?.translationOrigin,'at-your-service');
assert.ok(briny?.description.includes('Совершите дистанционную атаку заклинанием'));
assert.ok(briny?.rules.outcomes?.criticalSuccess?.includes('растерянность на 1 минуту'));
assert.ok(briny?.rules.outcomes?.success?.includes('слепоту на 1 раунд'));
assert.ok(briny?.rules.outcomes?.criticalSuccess?.includes('но не от растерянности'));
assert.equal(briny?.rules.heightened?.['+1'],'Урон увеличивается на 2d6.');

for(const slug of ["ancient-dust","approximate","caustic-blast","frosts-touch","ghost-sound","glamorize","glass-shield","illuminate","infectious-enthusiasm","invoke-true-name","know-the-way","live-wire","root-reading","take-root","timber"]) {
  const view=liveViews.find(v=>v.spell.slug===slug);
  assert.ok(view?.description.length>200,'Full Russian cantrip text: '+slug);
  assert.equal(view?.translationOrigin,'at-your-service','Attribution for audited cantrip: '+slug);
}
for(const [slug,formula] of [['caustic-blast','1d8'],['glass-shield','1d4'],['live-wire','1d4'],['timber','2d4']]) {
  assert.ok(liveViews.find(v=>v.spell.slug===slug)?.description.includes(formula),'Critical dice retained: '+slug);
}

const secondWaveSlugs=["aqueous-blast","armor-of-thorn-and-claw","breathe-fire","briny-bolt","camel-spit","chilling-spray","concordant-choir","conductive-weapon","cycle-of-retribution","dehydrate","draw-ire","flourishing-flora","forced-mercy","forge","gust-of-wind","hippocampus-retreat","horizon-thunder-sphere","infuse-vitality","kinetic-ram","noxious-vapors","phantom-pain","pummeling-rubble","rainbows-end","sacred-beasts","scorching-blast","shattering-gem","shocking-grasp","shockwave","signal-skyrocket","spider-sting","threefold-limb","wooden-fists"];
assert.equal(secondWaveSlugs.length,32,'Audited formula-missing entries in rank one');
for(const slug of secondWaveSlugs){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.locale==='ru','Russian wave two card: '+slug);
 assert.ok(card.description.length>=190,'Complete mechanics instead of a short summary: '+slug);
 assert.equal(card.translationOrigin,'at-your-service','Translation attribution: '+slug);
}
for(const [slug,formula] of [['aqueous-blast','2d8'],['breathe-fire','2d6'],['briny-bolt','4d6'],['chilling-spray','2d4'],['dehydrate','3d6'],['horizon-thunder-sphere','3d6'],['phantom-pain','2d4'],['signal-skyrocket','1d10'],['spider-sting','1d4'],['wooden-fists','4d6']]){
 assert.ok(liveViews.find(v=>v.spell.slug===slug)?.description.includes(formula),'Wave two damage formula: '+slug);
}
const authoredRankOne=liveViews.filter(v=>v.spell.rank<=1&&v.translationOrigin==='at-your-service');
// Wave 05: verify all mechanically meaningful dice, not just one token per spell.
// The published catalog may move heightening into structured rules rather than description.
const fifthWaveDamageCases = {
 'exploding-earth':['4d6','1d6','2d6'],
 'feast-of-ashes':['1d4','2d4'],
 'feral-shades':['2d4','1d4'],
 'final-sacrifice':['6d6','2d6'],
 'floating-flame':['3d6','1d6'],
 'fungal-hyphae':['3d8'], // Damage only becomes available at spell rank 4.
 'heat-metal':['4d6','2d4','1d4'],
 'ignite-fireworks':['1d8','1d4'],
 'illusory-creature':['3d4'],
 'inner-radiance-torrent':['4d4','2d4'],
 'murder-of-crows':['6d4','3d4'],
 'noise-blast':['2d10','1d10'],
 'piercing-jet':['4d6','2d6'],
 'shatter':['2d10','1d10'],
 'spiritual-armament':['2d8','1d8'],
 'spiritual-weapon':['2d8','1d8'],
 'vomit-swarm':['2d8','1d8'],
 'warriors-regret':['1d8','2d8','4d8']
};
assert.equal(Object.keys(fifthWaveDamageCases).length,18,'Wave 05 formula queue is 18 distinct RU cards; 20 EN-only cards are tracked separately');
for(const [slug,dice] of Object.entries(fifthWaveDamageCases)){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.spell.rank===2&&card.locale==='ru','Wave 05 rank-two Russian card: '+slug);
 const mechanics=[card.description,...Object.values(card.rules.heightened||{}),...Object.values(card.rules.outcomes||{})].join(' ');
 for(const formula of dice){
  assert.ok(mechanics.includes(formula),'Wave 05 mechanic '+slug+' is missing dice '+formula);
 }
}
const rankTwoAudit=(slug)=>liveViews.find(v=>v.spell.slug===slug)?.rules;
assert.equal(rankTwoAudit('heat-metal')?.edition,'pf2e-legacy');
assert.equal(rankTwoAudit('spiritual-weapon')?.edition,'pf2e-legacy');
assert.equal(rankTwoAudit('spiritual-armament')?.edition,'pf2e-remaster');
assert.equal(rankTwoAudit('floating-flame')?.sustain,true);
assert.equal(rankTwoAudit('spiritual-armament')?.sustain,true);
assert.ok(rankTwoAudit('fungal-hyphae')?.heightened?.['4']?.includes('3d8'));
assert.ok(rankTwoAudit('fungal-hyphae')?.heightened?.['6']);
for(const slug of ['feast-of-ashes','heat-metal','ignite-fireworks','noise-blast','warriors-regret']){
 assert.ok(rankTwoAudit(slug)?.outcomes?.criticalFailure,'Wave 05 critical failure mechanics: '+slug);
}
assert.ok(liveViews.find(v=>v.spell.slug==='inner-radiance-torrent')?.description.includes('ещё 2 действия'),'Current Foundry rank-two two-round casting variant');


const sixthWaveSlugs=["blood-vendetta","boneshaker","brand-the-impenitent","charitable-urge","deafness","death-knell","expeditious-excavation","fear-the-sun","fungal-infestation","ghoulish-cravings","laughing-fit","mental-map","paranoia","revealing-light","web","worms-repast"];
assert.equal(sixthWaveSlugs.length,16,'Wave six count');
for(const slug of sixthWaveSlugs){
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view?.spell.rank===2&&view.locale==='ru','Wave 6 rank-two Russian spell: '+slug);
 assert.equal(view.translationOrigin,'at-your-service','Wave 6 original translation attribution: '+slug);
 assert.ok(view.description.length>=350,'Wave 6 full rather than abbreviated description: '+slug);
 assert.ok(!view.description.includes('**'),'Wave 6 should not expose markdown stars: '+slug);
 for(const [key,title] of Object.entries({criticalSuccess:'Критический успех',success:'Успех',failure:'Провал',criticalFailure:'Критический провал'})){
   if(view.rules.outcomes?.[key]) assert.ok(view.description.includes(title+': '+view.rules.outcomes[key]),'Complete outcome '+key+': '+slug);
 }
 for(const [level,value] of Object.entries(view.rules.heightened||{}))
  assert.ok(view.description.includes(value),'Missing rank enhancement '+level+': '+slug);
}
for(const slug of ['boneshaker','brand-the-impenitent','death-knell','worms-repast'])
 assert.equal(liveViews.find(v=>v.spell.slug===slug)?.rules.edition,'pf2e-legacy','Keep Legacy version: '+slug);
assert.equal(liveViews.find(v=>v.spell.slug==='blood-vendetta')?.rules.cast?.time,'Реакция');
assert.equal(liveViews.find(v=>v.spell.slug==='boneshaker')?.rules.cast?.time,'2 или 3 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='laughing-fit')?.rules.sustain,true);

// Wave 07 audit: 69 previously dynamically overlaid Russian rank-two cards and 20 short native-RU cards.
// The rank-one Funeral Flames directory anomaly is included in the 70 archived author translations.
const waveSevenFlaggedIds=["pf2e-advanced-scurvy","pf2e-allfood","pf2e-animal-form","pf2e-avenging-wildwood","pf2e-bee-man-s-summons","pf2e-binding-muzzle","pf2e-blast-of-the-bellows","pf2e-blood-duplicate","pf2e-blood-runs-cold","pf2e-bone-spray","pf2e-bralani-referendum","pf2e-breath-of-drought","pf2e-brine-dragon-bile","pf2e-carrion-mire","pf2e-confetti-cloud","pf2e-cutting-insult","pf2e-dancing-shield","pf2e-darkvision","pf2e-dimensional-drop","pf2e-disintegrating-puddle","pf2e-disorienting-flash","pf2e-draw-blood","pf2e-electrostatic-glider","pf2e-embed-message","pf2e-empathic-link","pf2e-enlarge","pf2e-erase-trail","pf2e-explosive-dust","pf2e-familiars-resurrection","pf2e-far-flung-fetch","pf2e-floating-harness","pf2e-frozen-lungs","pf2e-glacial-causeway","pf2e-grave-impressions","pf2e-helpful-reload","pf2e-helpful-scribe","pf2e-horrifying-blood-loss","pf2e-illusory-shroud","pf2e-imp-sting","pf2e-impart-empathy","pf2e-impeccable-flow","pf2e-imprinting-hand","pf2e-infernal-supervision","pf2e-manifestation-of-spirits","pf2e-mark-of-blood","pf2e-marvelous-mount","pf2e-metal-reverberation","pf2e-mind-games","pf2e-mist-sight","pf2e-oaken-resilience","pf2e-one-with-plants","pf2e-osseous-cage","pf2e-pack-attack","pf2e-palm-held-sun","pf2e-pave-ground","pf2e-peaceful-rest","pf2e-penumbral-disguise","pf2e-persistent-servant","pf2e-phantasmal-treasure","pf2e-quench","pf2e-radiant-field","pf2e-reapers-lantern","pf2e-resist-energy","pf2e-restoration","pf2e-retrieving-hook","pf2e-rime-slick","pf2e-saturate","pf2e-sea-surge","pf2e-shadow-zombie","pf2e-shift-perspective","pf2e-spys-mark","pf2e-steel-fortifications","pf2e-summoners-precaution","pf2e-summoners-visage","pf2e-swallow-light","pf2e-the-parrots-whisper","pf2e-thermal-remedy","pf2e-thunder-echo","pf2e-thundering-dominance","pf2e-tracing-bond","pf2e-umbral-mindtheft","pf2e-uncover-device","pf2e-unrelenting-gravity","pf2e-vanish-weapon","pf2e-veil-of-spirits","pf2e-vicious-jealousy","pf2e-warping-pull","pf2e-watchdog","pf2e-with-friends-like-these"];
assert.equal(waveSevenFlaggedIds.length,89,'Wave 07 precisely covers 89 rank-two audit entries');
assert.equal(new Set(waveSevenFlaggedIds).size,89,'Wave 07 has no duplicate IDs');
for(const id of waveSevenFlaggedIds){
 const card=liveViews.find(v=>v.id===id);
 assert.ok(card&&card.locale==='ru'&&card.spell.rank===2,'Wave 07 full Russian rank-two card: '+id);
 assert.equal(card.translationOrigin,'at-your-service','Wave 07 author credit preserved: '+id);
 assert.ok(card.description.length>=160,'Wave 07 must contain substantial Russian mechanics: '+id);
 const russian=wave.translations.find(t=>t.spellId===id&&t.locale==='ru');
 const original=wave.translations.find(t=>t.spellId===id&&t.locale==='en');
 assert.ok(original?.description&&russian?.description,'Wave 07 retains both EN original and RU: '+id);
 assert.ok(russian.translatorCredit?.includes('Перевод от At your service!'),'Wave 07 source label: '+id);
}
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.some(s=>s.id===t.spellId&&s.rank===2)).length,223);
assert.ok(liveViews.find(v=>v.spell.slug==='funeral-flames')?.locale==='ru','Rank-one Funeral Flames migrated');
assert.ok(!source('../src/features/spell-library/SpellLibrary.tsx').includes('const patchFiles='),
 'Author translation overlays cannot replace audited main-catalog cards at runtime');
const archivedCycles=['../public/spell-library/pf2e-ays-rank2-cycle1.json','../public/spell-library/pf2e-ays-rank2-cycle2.json']
 .flatMap(path=>JSON.parse(source(path)).entries);
assert.equal(archivedCycles.length,70,'Both archived translation cycles kept as provenance');
for(const entry of archivedCycles){
 const actual=liveViews.find(v=>v.englishName===entry.englishName);
 assert.ok(actual&&actual.name===entry.name&&actual.locale==='ru','Merged overlay Russian title: '+entry.englishName);
}
for(const slug of ['dancing-shield','darkvision','embed-message','enlarge','far-flung-fetch','helpful-reload','marvelous-mount','oaken-resilience','pack-attack','pave-ground','peaceful-rest','radiant-field','resist-energy','restoration']){
 const card=liveViews.find(v=>v.spell.slug===slug);
 for(const desc of Object.values(card?.rules.heightened||{}))
  assert.ok(card.description.includes(desc),'Wave 07 inline enhancement must survive: '+slug);
}

const eighthWaveQueue=["pf2e-acid-arrow","pf2e-acid-grip","pf2e-albatross-curse","pf2e-animal-messenger","pf2e-animated-assault","pf2e-animus-mine","pf2e-ash-cloud","pf2e-augury","pf2e-banishing-touch","pf2e-befitting-attire","pf2e-blazing-armory","pf2e-blazing-blade","pf2e-blazing-bolt","pf2e-blistering-invective","pf2e-blur","pf2e-burrow-ward","pf2e-buzzing-servants","pf2e-calm","pf2e-cauterize-wounds","pf2e-clad-in-metal","pf2e-claws-of-the-otter","pf2e-clawsong","pf2e-cleanse-affliction","pf2e-cleanse-air","pf2e-clear-mind","pf2e-coiling-dance","pf2e-create-food","pf2e-darkness","pf2e-dismantle","pf2e-dispel-magic","pf2e-elemental-zone","pf2e-empty-pack","pf2e-enhance-victuals","pf2e-entangling-flora","pf2e-environmental-endurance","pf2e-everlight","pf2e-extract-poison","pf2e-faerie-fire","pf2e-false-vitality","pf2e-falsify-heat","pf2e-fireproof","pf2e-flame-wisp","pf2e-frog-tongue","pf2e-gecko-grip","pf2e-gentle-breeze","pf2e-ghostly-carrier","pf2e-guiding-star","pf2e-helpful-wood-spirits","pf2e-hidebound","pf2e-humanoid-form","pf2e-instant-armor","pf2e-invisibility","pf2e-iron-gut","pf2e-kgalaserkes-axes","pf2e-knock","pf2e-lock-item","pf2e-loose-times-arrow","pf2e-lucky-number","pf2e-magnetic-attraction","pf2e-magnetic-repulsion","pf2e-mimic-undead","pf2e-mirror-image","pf2e-mist","pf2e-phantom-crowd","pf2e-propulsive-breeze","pf2e-pyrefowl-rebuke","pf2e-rapid-adaptation","pf2e-rubble-step","pf2e-see-the-unseen","pf2e-shape-wood","pf2e-share-life","pf2e-shrink","pf2e-silence","pf2e-slough-skin","pf2e-sonata-span","pf2e-sound-body","pf2e-speak-with-animals","pf2e-spirit-sense","pf2e-splinter-volley","pf2e-spray-of-salt","pf2e-status","pf2e-sticky-fire","pf2e-stupefy","pf2e-sudden-blight","pf2e-sudden-bolt","pf2e-summon-elemental","pf2e-sure-footing","pf2e-tacky-pine-sap","pf2e-teeth-to-terror","pf2e-telekinetic-maneuver","pf2e-the-queens-rainbow","pf2e-timely-reminder","pf2e-timely-tutor","pf2e-translate","pf2e-tremorsense","pf2e-umbral-extraction","pf2e-voice-on-the-breeze","pf2e-water-breathing","pf2e-water-walk","pf2e-waterproof"];
assert.equal(eighthWaveQueue.length,100,'Control wave eight exactly 100 rank-two Russian cards');
assert.equal(new Set(eighthWaveQueue).size,100,'No repeated spells in control wave');
for(const id of eighthWaveQueue){
 const v=liveViews.find(x=>x.id===id);
 assert.ok(v?.spell.rank===2&&v.locale==='ru','Wave 8 rank-two translated card: '+id);
 assert.equal(v.translationOrigin,'at-your-service','Wave 8 translation credit retained: '+id);
 assert.ok(v.description.length>=120,'Wave 8 mechanics not empty: '+id);
 assert.ok(!v.description.includes('**'),'Wave 8 no raw bold-markup in spell description: '+id);
 assert.ok(!/^Усиление\s*\(/m.test(v.description),'Wave 8 uses recognized heightened heading: '+id);
 for(const [level,desc] of Object.entries(v.rules.heightened||{})){
  const label=level.startsWith('+')?level:level+'-й ранг';
  assert.ok(v.description.includes('Повышение ('+label+'):'),
   'Wave 8 rank enhancement must be shown in the spell popup: '+id+' rank '+level);
  const translated=wave.translations.find(x=>x.spellId===id&&x.locale==='ru');
  assert.equal(translated?.description,v.description,'Wave 8 main catalog text intact: '+id);
 }
 for(const [key,text] of Object.entries(v.rules.outcomes||{})){
  const labels={criticalSuccess:'Критический успех',success:'Успех',failure:'Провал',criticalFailure:'Критический провал'};
  assert.ok(v.description.includes(labels[key]+':'),'Wave 8 inline outcome visible: '+id+' '+key);
 }
 const eng=wave.translations.find(x=>x.spellId===id&&x.locale==='en');
 assert.ok(eng?.description?.length>80,'Wave 8 original English mechanics retained: '+id);
 for(const damage of new Set(eng.description.match(/\d+d\d+/gi)||[]))
  assert.ok(v.description.includes(damage),'Wave 8 original damage dice preserved in Russian: '+id+' / '+damage);
}
assert.equal(eighthWaveQueue.filter(id=>Object.keys(liveViews.find(v=>v.id===id)?.rules.heightened||{}).length>0).length,42);
assert.deepEqual(['calm','lock-item'].sort(),eighthWaveQueue.filter(id=>Object.keys(liveViews.find(v=>v.id===id)?.rules.outcomes||{}).length>0).map(x=>x.replace(/^pf2e-/,'')).sort());
const authoredRankTwo=liveViews.filter(v=>v.spell.rank===2&&v.translationOrigin==='at-your-service');
assert.equal(authoredRankOne.length,165,
  'Original first-party localizations and all 15 audited cantrips retain AYS attribution');
assert.equal(authoredRankTwo.length,223,
  'All 154 independently localized rank-two cards retain AYS attribution');
assert.equal(liveViews.filter(v=>v.translationOrigin==='at-your-service').length,388,
  'The first-party translation total includes both the original and rank-two waves');
for(const card of authoredRankTwo){
  assert.equal(card.locale,'ru','Authored rank-two card must be in Russian: '+card.spell.slug);
  assert.ok(card.description.length>(['spray-of-salt','status','sticky-fire','stupefy','sudden-blight','sudden-bolt','summon-elemental','sure-footing','swallow-light','tacky-pine-sap','teeth-to-terror','telekinetic-maneuver','the-queens-rainbow','thermal-remedy','thunder-echo','timely-reminder','paranoia','noise-blast','oaken-resilience','pack-attack','pave-ground','peaceful-rest','phantom-crowd','piercing-jet','propulsive-breeze','pyrefowl-rebuke','radiant-field','rapid-adaptation','reapers-lantern','resist-energy','restoration'].includes(card.spell.slug)?45:150),'Authored rank-two card needs Russian mechanics or separately structured outcomes: '+card.spell.slug);
  assert.ok(card.englishName&&card.englishName!==card.name,'Keep the original English spell name: '+card.spell.slug);
  const credit=wave.translations.find(t=>t.spellId===card.id&&t.locale==='ru')?.translatorCredit;
  assert.ok(credit?.includes('Перевод от At your service!'),'Explicit AYS translator credit required: '+card.spell.slug);
}
const rankTwoWave02Ru=["blood-vendetta","blur","boneshaker","brand-the-impenitent","brine-dragon-bile","burrow-ward","buzzing-servants","calm","cauterize-wounds","charitable-urge","clad-in-metal","claws-of-the-otter","clawsong","cleanse-affliction","cleanse-air","clear-mind","coiling-dance","create-food"];
const rankTwoWave02En=["bone-spray","bralani-referendum","breath-of-drought","carrion-mire","confetti-cloud"];
assert.equal(rankTwoWave02Ru.length,18);
for(const slug of rankTwoWave02Ru){
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view,'Wave-02 spell must be imported: '+slug);
 assert.equal(view.locale,'ru','Verified name and author translation must be Russian: '+slug);
 assert.equal(view.translationOrigin,'at-your-service','Author credit must be visible: '+slug);
 assert.ok(view.description.length>150,'Full Russian game rules must be retained: '+slug);
 assert.ok(!/\\b(?:Critical Success|Critical Failure|Heightened|Sustain the spell)\\b/.test(view.description),'English mechanics leaked into RU description: '+slug);
}
for(const slug of rankTwoWave02En){
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view&&view.locale==='ru'&&view.name!==view.englishName,'Unverified Russian title must not be invented: '+slug);
 assert.ok(rankTwoTracker.includes('| '+view.englishName+' |'),'English backlog must include wave 02: '+slug);
}
assert.equal(liveViews.find(v=>v.spell.slug==='blood-vendetta')?.rules.cast?.time,'Реакция');
assert.equal(liveViews.find(v=>v.spell.slug==='boneshaker')?.rules.cast?.time,'2 или 3 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='confetti-cloud')?.rules.cast?.time,'1–3 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='create-food')?.rules.cast?.time,'1 час');
assert.equal(liveViews.find(v=>v.spell.slug==='clawsong')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='clear-mind')?.rules.heightened?.['8']?.includes('ошеломление'));

const rankTwoWave03Ru=["dancing-shield","darkness","darkvision","deafness","death-knell","dismantle","dispel-magic","elemental-zone","embed-message","empty-pack","enhance-victuals","enlarge","entangling-flora","environmental-endurance","everlight"];
const rankTwoWave03En=["cutting-insult","dimensional-drop","disintegrating-puddle","disorienting-flash","draw-blood","electrostatic-glider","empathic-link","erase-trail"];
assert.equal(rankTwoWave03Ru.length,15); assert.equal(rankTwoWave03En.length,8);
for(const slug of rankTwoWave03Ru){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.locale==='ru'&&card.translationOrigin==='at-your-service','Wave-03 translation attribution: '+slug);
 assert.ok(card.description.length>150,'Substantive localized mechanics: '+slug);
 assert.ok(card.englishName&&card.englishName!==card.name,'Original name retained: '+slug);
 assert.ok(wave.translations.some(t=>t.spellId===card.id&&t.locale==='ru'&&t.translatorCredit?.includes('Перевод от At your service!')),'Translator credit: '+slug);
}
for(const slug of rankTwoWave03En){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.locale==='ru'&&card.name!==card.englishName,'No invented translation: '+slug);
 assert.ok(rankTwoTracker.includes('| '+card.englishName+' |'),'Backlog entry: '+slug);
}
assert.equal(liveViews.find(v=>v.spell.slug==='disorienting-flash')?.rules.cast?.time,'1–3 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='environmental-endurance')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='empathic-link')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='darkness')?.rules.cast?.actions,3);
assert.equal(liveViews.find(v=>v.spell.slug==='dancing-shield')?.rules.sustain,true);
assert.ok(liveViews.find(v=>v.spell.slug==='elemental-zone')?.description.includes('металл'));
assert.ok(liveViews.find(v=>v.spell.slug==='enlarge')?.rules.heightened?.['6']?.includes('10 согласным'));

const rankTwoWave04RU=["expeditious-excavation","exploding-earth","extract-poison","faerie-fire","false-vitality","falsify-heat","far-flung-fetch","fear-the-sun","feast-of-ashes","feral-shades","final-sacrifice","fireproof","flame-wisp","floating-flame","frog-tongue","fungal-hyphae","fungal-infestation","gecko-grip"];
const rankTwoWave04EN=["explosive-dust","familiars-resurrection","floating-harness","frozen-lungs"];
assert.equal(rankTwoWave04RU.length,18);
assert.equal(rankTwoWave04EN.length,4);
for(const slug of rankTwoWave04RU){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card,'Wave 04 imported: '+slug);
 assert.equal(card.spell.rank,2,'Wave 04 valid rank: '+slug);
 assert.equal(card.locale,'ru','Verified Russian title: '+slug);
 assert.equal(card.translationOrigin,'at-your-service','Authored Russian mechanics: '+slug);
 assert.ok(card.description.length>=155,'Russian description has substantive mechanics: '+slug);
 const translation=wave.translations.find(v=>v.spellId===card.id&&v.locale==='ru');
 assert.ok(translation?.translatorCredit?.includes('Перевод от At your service!'),'Translator credit: '+slug);
}
for(const slug of rankTwoWave04EN){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.locale==='ru'&&card.name!==card.englishName,'Do not invent translations: '+slug);
 assert.equal(card.spell.rank,2,'Untranslated original rank 2: '+slug);
 assert.ok(rankTwoTracker.includes('| '+card.englishName+' |'),'English tracker includes '+slug);
}
const anomalous=liveViews.find(v=>v.spell.slug==='funeral-flames');
assert.ok(anomalous&&anomalous.spell.rank===1&&anomalous.locale==='ru',
  'Foundry rank-2 directory contains Funeral Flames with actual rank 1');
assert.ok(!filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:2}).some(v=>v.spell.slug==='funeral-flames'),
  'Never silently display a rank-one spell as rank two');
assert.ok(rankTwoTracker.includes('Funeral Flames'), 'Track the English source anomaly explicitly');
assert.equal(liveViews.find(v=>v.spell.slug==='fireproof')?.rules.cast?.time,'1 минута');
assert.equal(liveViews.find(v=>v.spell.slug==='familiars-resurrection')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='floating-flame')?.rules.sustain,true);
assert.ok(liveViews.find(v=>v.spell.slug==='fungal-infestation')?.rules.outcomes?.criticalFailure?.includes('слабость'));
assert.ok(liveViews.find(v=>v.spell.slug==='falsify-heat')?.rules.heightened?.['4']);


const rankTwoWave05Ru=["gentle-breeze","ghostly-carrier","ghoulish-cravings","guiding-star","heat-metal","helpful-reload","helpful-wood-spirits","hidebound","humanoid-form","ignite-fireworks","illusory-creature","inner-radiance-torrent"];
const rankTwoWave05En=["glacial-causeway","grave-impressions","helpful-scribe","horrifying-blood-loss","illusory-shroud","imp-sting","impart-empathy","impeccable-flow","imprinting-hand","infernal-supervision"];
assert.equal(rankTwoWave05Ru.length,12);
assert.equal(rankTwoWave05En.length,10);
for(const slug of rankTwoWave05Ru){
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view&&view.spell.rank===2&&view.locale==='ru'&&view.translationOrigin==='at-your-service','Wave 05 Russian rank/credit: '+slug);
 assert.ok(view.description.length>=200,'Full Wave 05 mechanics translated: '+slug);
 assert.ok(view.englishName&&view.englishName!==view.name,'Wave 05 original English name kept: '+slug);
 assert.ok(wave.translations.some(t=>t.spellId===view.id&&t.locale==='ru'&&t.translatorCredit?.includes('Перевод от At your service!')),'Authored translation credit: '+slug);
}
for(const slug of rankTwoWave05En){
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view&&view.spell.rank===2&&view.locale==='ru'&&view.name!==view.englishName,'Wave 05 unverified Russian name not invented: '+slug);
 assert.ok(rankTwoTracker.includes('| '+view.englishName+' |'),'Wave 05 English register: '+slug);
}
assert.equal(liveViews.find(v=>v.spell.slug==='helpful-reload')?.rules.cast?.time,'Реакция');
assert.equal(liveViews.find(v=>v.spell.slug==='hidebound')?.rules.cast?.time,'Реакция');
assert.equal(liveViews.find(v=>v.spell.slug==='grave-impressions')?.rules.cast?.time,'1 минута');
assert.equal(liveViews.find(v=>v.spell.slug==='inner-radiance-torrent')?.rules.cast?.time,'2 или 3 действия / 2 раунда');
assert.equal(liveViews.find(v=>v.spell.slug==='helpful-wood-spirits')?.rules.sustain,true);
assert.equal(liveViews.find(v=>v.spell.slug==='illusory-creature')?.rules.sustain,true);
assert.equal(liveViews.find(v=>v.spell.slug==='heat-metal')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='illusory-creature')?.rules.heightened?.['+1']);
assert.ok(liveViews.find(v=>v.spell.slug==='ignite-fireworks')?.rules.outcomes?.criticalFailure?.includes('1d4'));

const rankTwoWave06Ru=["instant-armor","invisibility","iron-gut","kgalaserkes-axes","knock","laughing-fit","lock-item","loose-times-arrow","lucky-number","magnetic-attraction","magnetic-repulsion","marvelous-mount","mental-map","mimic-undead","mirror-image","mist","murder-of-crows"];
const rankTwoWave06En=["manifestation-of-spirits","mark-of-blood","metal-reverberation","mind-games","mist-sight"];
assert.equal(rankTwoWave06Ru.length,17);
assert.equal(rankTwoWave06En.length,5);
for(const slug of rankTwoWave06Ru){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.spell.rank===2&&card.locale==='ru'&&card.translationOrigin==='at-your-service','Wave 06 Russian: '+slug);
 assert.ok(card.description.length>=180,'Wave 06 substantial translation: '+slug);
 assert.ok(card.englishName&&card.englishName!==card.name,'Original English identity: '+slug);
 assert.ok(wave.translations.some(t=>t.spellId===card.id&&t.locale==='ru'&&t.translatorCredit?.includes('Перевод от At your service!')),'Russian authored attribution: '+slug);
}
for(const slug of rankTwoWave06En){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.spell.rank===2&&card.locale==='ru'&&card.name!==card.englishName,'No invented names: '+slug);
 assert.ok(rankTwoTracker.includes('| '+card.englishName+' |'),'English tracker wave 06: '+slug);
}
assert.equal(liveViews.find(v=>v.spell.slug==='instant-armor')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='kgalaserkes-axes')?.rules.cast?.time,'1 или 2 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='lucky-number')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='mist')?.rules.cast?.actions,3);
assert.equal(liveViews.find(v=>v.spell.slug==='mimic-undead')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='mirror-image')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='laughing-fit')?.rules.sustain,true);
assert.equal(liveViews.find(v=>v.spell.slug==='metal-reverberation')?.rules.sustain,true);
assert.ok(liveViews.find(v=>v.spell.slug==='lock-item')?.rules.outcomes?.criticalFailure?.includes('1 минуту'));
assert.ok(liveViews.find(v=>v.spell.slug==='invisibility')?.rules.heightened?.['4']?.includes('враждебного'));
assert.equal(liveViews.find(v=>v.spell.slug==='loose-times-arrow')?.name,'Выпустить стрелу времени');


const wave09ru=["spray-of-salt","status","sticky-fire","stupefy","sudden-blight","sudden-bolt","summon-elemental","sure-footing","swallow-light","tacky-pine-sap","teeth-to-terror","telekinetic-maneuver","the-queens-rainbow","thermal-remedy","thunder-echo","timely-reminder"];
const wave09en=["spys-mark","steel-fortifications","summoners-precaution","summoners-visage","the-parrots-whisper","thundering-dominance"];
for(const slug of wave09ru){const v=liveViews.find(v=>v.spell.slug===slug);assert.ok(v&&v.locale==='ru'&&v.spell.rank===2&&v.translationOrigin==='at-your-service','Wave09 RU: '+slug);}
for(const slug of wave09en){const v=liveViews.find(v=>v.spell.slug===slug);assert.ok(v&&v.locale==='ru'&&v.spell.rank===2,'Wave09 EN: '+slug);assert.ok(rankTwoTracker.includes('| '+v.englishName+' |'));}

const wave10ru=["timely-tutor","translate","tremorsense","umbral-extraction","voice-on-the-breeze","vomit-swarm","warriors-regret","water-breathing","water-walk","waterproof","web","worms-repast"];
const wave10en=["tracing-bond","umbral-mindtheft","uncover-device","unrelenting-gravity","vanish-weapon","veil-of-spirits","vicious-jealousy","warping-pull","watchdog","with-friends-like-these"];
assert.equal(wave10ru.length,12);
assert.equal(wave10en.length,10);
for(const slug of wave10ru){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.spell.rank===2&&card.locale==='ru'&&card.translationOrigin==='at-your-service','Wave10 RU with credited draft: '+slug);
 const translation=wave.translations.find(t=>t.spellId===card.id&&t.locale==='ru');
 assert.ok(translation?.translatorCredit?.includes('Перевод от At your service!'),'Wave10 translation credit: '+slug);
 assert.ok(card.englishName!==card.name,'Wave10 English identity retained: '+slug);
}
for(const slug of wave10en){
 const card=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(card&&card.spell.rank===2&&card.locale==='ru'&&card.name!==card.englishName,'Wave10 EN original: '+slug);
 assert.ok(rankTwoTracker.includes('| '+card.englishName+' |'),'Wave10 English registry: '+slug);
}
assert.equal(liveViews.find(v=>v.spell.slug==='water-breathing')?.rules.cast?.time,'1 минута');
assert.equal(liveViews.find(v=>v.spell.slug==='vanish-weapon')?.rules.cast?.time,'Реакция');
assert.equal(liveViews.find(v=>v.spell.slug==='worms-repast')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='web')?.rules.outcomes?.criticalFailure?.includes('обездвиженным'));
assert.ok(liveViews.find(v=>v.spell.slug==='umbral-extraction')?.description.includes('временную ячейку'));

const wave08ru=["revealing-light","rubble-step","see-the-unseen","shape-wood","share-life","shatter","shrink","silence","slough-skin","sonata-span","sound-body","speak-with-animals","spirit-sense","spiritual-armament","spiritual-weapon","splinter-volley"];
const wave08en=["retrieving-hook","rime-slick","saturate","sea-surge","shadow-zombie","shift-perspective"];
assert.equal(wave08ru.length,16);
assert.equal(wave08en.length,6);
for(const slug of wave08ru) {
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view&&view.spell.rank===2&&view.locale==='ru'&&view.translationOrigin==='at-your-service','RU wave 08: '+slug);
 assert.ok(view.description.length>180,'RU detailed mechanics wave 08: '+slug);
 assert.ok(wave.translations.some(t=>t.spellId===view.id&&t.locale==='ru'&&t.translatorCredit?.includes('Перевод от At your service!')),'Translation mark: '+slug);
}
for(const slug of wave08en) {
 const view=liveViews.find(v=>v.spell.slug===slug);
 assert.ok(view&&view.spell.rank===2&&view.locale==='ru'&&view.name!==view.englishName,'EN wave 08: '+slug);
 assert.ok(rankTwoTracker.includes('| '+view.englishName+' |'),'English register wave 08: '+slug);
}
for(const slug of ['noise-blast','restoration'])assert.ok(liveViews.some(v=>v.spell.slug===slug),'Wave 07 imported: '+slug);
assert.equal(liveViews.find(v=>v.spell.slug==='spiritual-armament')?.rules.edition,'pf2e-remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='spiritual-weapon')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='splinter-volley')?.rules.cast?.time,'2 или 3 действия');
assert.equal(liveViews.find(v=>v.spell.slug==='sonata-span')?.rules.sustain,true);
assert.ok(liveViews.find(v=>v.spell.slug==='revealing-light')?.rules.outcomes?.criticalFailure?.includes('10 минут'));
assert.ok(liveViews.find(v=>v.spell.slug==='sound-body')?.rules.heightened?.['8']);
assert.equal(liveViews.find(v=>v.spell.slug==='rime-slick')?.rules.edition,'pf2e-legacy');

const wave1Names={
  'ancient-dust':'Древний прах',
  'artistic-recollection':'Художественное воспоминание',
  'bramble-bush':'Колючий куст',
  'create-earthen-facsimile':'Создание земляного подобия',
  'glowing-trail':'Светящийся след',
  'inside-ropes':'Верёвка из внутренностей',
  'join-pasts':'Связь воспоминаний',
  'musical-accompaniment':'Музыкальное сопровождение',
  'torturous-trauma':'Мучительная травма',
};
for(const [slug,name] of Object.entries(wave1Names)){
  const entry=liveViews.find(v=>v.spell.slug===slug);
  assert.equal(entry?.name,name,'Authored Russian spell title: '+slug);
  assert.equal(entry?.locale,'ru','Wave 1 must no longer fall back to English: '+slug);
  assert.equal(entry?.translationOrigin,'at-your-service','Every original translation is credited: '+slug);
  assert.ok(entry?.description.length>150,'Translate full mechanical text, not a placeholder: '+slug);
}

const firstCycle=[
  ['admonishing-ray','Вразумляющий луч','pf2e-legacy'],
  ['airburst','Воздушный выброс','pf2e-legacy'],
  ['blessing-of-vigor','Благословение жизненных сил','pf2e-remaster'],
  ['bone-shield','Костяной щит','pf2e-remaster'],
  ['buffeting-winds','Шквальные ветры','pf2e-legacy'],
  ['celestial-accord','Небесное согласие','pf2e-legacy'],
  ['cinder-scribe','Пепельный писец','pf2e-remaster'],
  ['connective-current','Связующий поток','pf2e-remaster'],
  ['cradle-aloft','Парящая колыбель','pf2e-remaster'],
  ['curse-of-slippery-steps','Проклятие скользких шагов','pf2e-remaster'],
  ['cycle-of-retribution','Круг возмездия','pf2e-remaster'],
  ['decompose','Разложение','pf2e-remaster'],
  ['defended-by-spirits','Под защитой духов','pf2e-remaster'],
  ['devils-horseshoe','Дьявольская подкова','pf2e-remaster'],
  ['dome-of-tranquility','Купол безмятежности','pf2e-remaster'],
  ['elysian-whimsy','Причуда Элизиума','pf2e-legacy'],
];
assert.equal(firstCycle.length,16);
for(const [slug,russian,edition] of firstCycle){
  const view=liveViews.find(v=>v.spell.slug===slug);
  assert.ok(view,'Translated spell must exist: '+slug);
  assert.equal(view.name,russian,'Russian spell title: '+slug);
  assert.equal(view.locale,'ru','Russian card locale: '+slug);
  assert.equal(view.rules.edition,edition,'Legacy/Remaster source must be preserved: '+slug);
  assert.equal(view.translationOrigin,'at-your-service','Every self-authored spell has its AYS label: '+slug);
  assert.ok(view.englishName.length>3&&view.englishName!==view.name,'English original must remain searchable: '+slug);
  assert.ok(view.description.length>50,'Full spell description missing: '+slug);
  const entry=wave.translations.find(t=>t.spellId===view.id&&t.locale==='ru');
  assert.ok(entry?.translatorCredit?.includes('Перевод от At your service!'),
    'Self-authored credits must be retained: '+slug);
  assert.ok(!/\b(?:Critical Success|Critical Failure|Heightened|Sustain)\b/.test(view.description),
    'English mechanic remains in authored Russian card: '+slug);
}
const firstCycleBySlug=slug=>liveViews.find(v=>v.spell.slug===slug);
assert.equal(firstCycleBySlug('bone-shield')?.rules.heightened?.['+2'],'Твёрдость щита увеличивается на 3.');
assert.ok(firstCycleBySlug('buffeting-winds')?.description.includes('2d4 дробящего урона'));
assert.ok(!firstCycleBySlug('buffeting-winds')?.description.includes('сбивает с ног живых'),
  'Buffeting Winds must not falsely impose prone');
assert.ok(firstCycleBySlug('celestial-accord')?.description.includes('проявляет враждебность'));
assert.equal(firstCycleBySlug('cycle-of-retribution')?.rules.sustain,true);
assert.equal(firstCycleBySlug('cycle-of-retribution')?.rules.duration,'Поддерживаемое, до 1 минуты');
assert.equal(firstCycleBySlug('defended-by-spirits')?.rules.sustain,true);
assert.equal(firstCycleBySlug('defended-by-spirits')?.rules.duration,'Поддерживаемое, до 1 минуты');
assert.ok(firstCycleBySlug('devils-horseshoe')?.rules.outcomes?.failure?.includes('Бестия'));
assert.ok(!firstCycleBySlug('devils-horseshoe')?.description.includes('Когда бес проходит'),
  'Fiend must not be narrowed to an imp');
assert.ok(firstCycleBySlug('elysian-whimsy')?.description.includes('4 — Неожиданная щедрость'));
assert.ok(firstCycleBySlug('cinder-scribe')?.rules.heightened?.['4']?.includes('неограниченной'));
assert.equal(firstCycleBySlug('airburst')?.rules.heightened?.['4']?.includes('10 футов'),true);
assert.equal(firstCycleBySlug('cradle-aloft')?.rules.cast?.actions,1);
assert.equal(liveViews.filter(v=>v.spell.kind==='cantrip'&&v.locale==='en').length,0,
  'All 71 cantrips must be available in Russian');
assert.ok(liveViews.find(v=>v.spell.slug==='ancient-dust')?.rules.outcomes?.criticalFailure?.includes('двойной'));
assert.equal(liveViews.find(v=>v.spell.slug==='ancient-dust')?.rules.heightened?.['+2'],
  'Начальный урон пустотой увеличивается на 1d6, а продолжительный урон — на 1.');
assert.ok(liveViews.find(v=>v.spell.slug==='bramble-bush')?.description.includes('опасной местностью'));
assert.ok(liveViews.find(v=>v.spell.slug==='bramble-bush')?.rules.heightened?.['+2']?.includes('1d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='inside-ropes')?.description.includes('чистую проверку со СЛ 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='glowing-trail')?.description.includes('10 минут'));
assert.ok(liveViews.find(v=>v.spell.slug==='musical-accompaniment')?.description.includes('штраф −4'));
assert.ok(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.description.includes('внутренних органов'));

assert.ok(liveViews.every(v=>Boolean(v.source?.name)),'Each spell has a credited source book');
assert.equal(SPELL_SYSTEMS.pf2e.maxRank,10);
assert.equal(SPELL_SYSTEMS.dnd5e.maxRank,9);
assert.equal(Object.keys(PF_TRADITIONS).length,4);
assert.equal(DND_SCHOOLS.length,8);
assert.throws(()=>parseSpellCatalog(emptySpellCatalog('pf2e'),'dnd5e'),/система каталога/);
assert.throws(()=>parseSpellCatalog({schemaVersion:1,system:'pf2e',spells:[],versions:[],translations:[]},'pf2e'),/массив/);

const catalog=emptySpellCatalog('pf2e');
catalog.sources.push({id:'core',name:'Player Core'});
catalog.spells.push({
  id:'pf2e-example',system:'pf2e',slug:'example-spell',kind:'cantrip',rank:0,
  traditions:['arcane','occult'],classes:[],traits:['mental'],rarity:'common',sourceId:'core',
});
catalog.versions.push({id:'remaster-example',spellId:'pf2e-example',edition:'pf2e-remaster',cast:{actions:2}});
catalog.translations.push(
  {spellId:'pf2e-example',versionId:'remaster-example',locale:'en',name:'Example Spell'},
  {spellId:'pf2e-example',versionId:'remaster-example',locale:'ru',name:'Пробное заклинание'},
);
const views=toSpellViews(parseSpellCatalog(catalog,'pf2e'),'pf2e-remaster');
assert.equal(views.length,1);
assert.equal(views[0].name,'Пробное заклинание');
assert.equal(views[0].translated,true);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,tradition:'arcane'}).length,1);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,tradition:'primal'}).length,0);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,query:'example spell'}).length,1);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,rank:1}).length,0);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length,1);
assert.equal(toSpellViews(catalog,'pf2e-legacy').length,0);

const app=source('../src/App.tsx');
const page=source('../src/features/spell-library/SpellLibrary.tsx');
assert.ok(app.includes('Персонажи</button>')&&app.includes('Библиотека</button>'));
assert.ok(app.includes("<SpellLibrary onBack="));
assert.ok(app.includes("currentSiteRoute()") && app.includes("siteRoutePath({kind:tab},import.meta.env.BASE_URL)"),'Library supports clean path links');
assert.ok(!page.includes('spell-library/pf2e.json'),'Base system catalogs retain independent dynamic paths');
assert.ok(page.includes('loadCachedSpellCatalog(system,controller.signal,import.meta.env.BASE_URL)'));
assert.ok(page.includes('section===\'mine\''));
assert.ok(page.includes('rules.ritual===true'),'D&D ritual flag remains distinct');
assert.ok(page.includes('setSelectedId(spell.id)'),'Spell details work after later import');
console.log('PASS: PF2e 71 cantrips + 189 rank-one + 223 rank-two spells (483 RU/0 EN), original English retained, Legacy, D&D untouched');

// Independent class spells: the legacy spell-slot corpus remains at 483 entries.
const necro=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-necromancer.json')),'pf2e');
assert.equal(necro.spells.length,10,'All ten first-rank grave spells imported');
assert.equal(necro.versions.length,10);
assert.equal(necro.translations.filter(t=>t.locale==='ru').length,10);
assert.equal(necro.translations.filter(t=>t.locale==='en').length,10);
assert.ok(necro.spells.every(s=>s.rank===1&&s.classes.includes('necromancer')&&s.rarity==='uncommon'));
assert.equal(necro.spells.filter(s=>s.kind==='cantrip').length,2);
assert.equal(necro.spells.filter(s=>s.kind==='focus').length,8);
assert.ok(necro.spells.every(s=>s.traditions.length===0),'Class-exclusive grave spells are not available to every occult caster');
assert.equal(necro.sources.length,1);
const necroViews=toSpellViews(necro,'pf2e-remaster');
assert.equal(necroViews.length,10);
const classOptions=availableGrimoireClasses(necroViews,['necromancer','bard']);
assert.deepEqual(classOptions,[{id:'necromancer',count:10}],
  'Only chosen classes with actual class spells produce a quick-filter button');
const allNecro=filterGrimoireEntries(necroViews,'all','all','',new Map(),'necromancer');
assert.equal(allNecro.length,10);
assert.equal(filterGrimoireEntries(necroViews,0,'all','',new Map(),'necromancer').length,2,
  'Class-specific rank-one cantrips must appear in the Cantrips section');
assert.equal(filterGrimoireEntries(necroViews,1,'all','',new Map(),'necromancer').length,8);
assert.equal(filterGrimoireEntries(necroViews,'all','all','',new Map(),'bard').length,0,
  'Other class filters must never leak Necromancer-only spells');
const mixedGrimoire=toSpellViews({...wave,spells:[...wave.spells,...necro.spells],
  versions:[...wave.versions,...necro.versions],
  translations:[...wave.translations,...necro.translations],
  sources:[...wave.sources,...necro.sources]},'pf2e-remaster');
assert.equal(filterGrimoireEntries(mixedGrimoire,'all','all','',new Map(),'necromancer').length,10,
  'Class filter must exclude normal occult spells even if the tradition is available');
assert.equal(filterGrimoireEntries(necroViews,'all','prepared','',
  new Map([[necroViews[0].id,{id:necroViews[0].id,prepared:true}]]),'necromancer').length,1,
  'Prepared-only mode and class filtering work together');
assert.equal(filterSpellViews(necroViews,{...DEFAULT_SPELL_FILTERS,className:'necromancer'}).length,10);
assert.equal(filterSpellViews(necroViews,{...DEFAULT_SPELL_FILTERS,query:'Некромант'}).length,10,
  'Russian class name searches all ten class-specific spells');
assert.equal(filterSpellViews(necroViews,{...DEFAULT_SPELL_FILTERS,tradition:'occult'}).length,0);
assert.equal(filterSpellViews(necroViews,{...DEFAULT_SPELL_FILTERS,kind:'focus'}).length,8);
for(const card of necroViews){
  assert.equal(card.locale,'ru');
  assert.equal(card.translationOrigin,'at-your-service');
  assert.ok(card.description.length>50,'Every necromancer card has substantive Russian mechanics: '+card.id);
  assert.ok(card.rules.cast?.actions===1||card.rules.cast?.actions===2);
  assert.equal(card.rules.resource,card.spell.kind==='cantrip'?'none':'focus-point');
}
assert.equal(necroViews.find(v=>v.spell.slug==='create-thrall')?.rules.cast?.actions,1);
assert.ok(necroViews.find(v=>v.spell.slug==='create-thrall')?.description.includes('двух прислужников'));
assert.equal(necroViews.find(v=>v.spell.slug==='bone-spear')?.rules.savingThrow,'Обычный спасбросок Рефлекса');
assert.equal(necroViews.find(v=>v.spell.slug==='dead-weight')?.rules.outcomes?.criticalFailure,'Существо замедлено 2 и застигнуто врасплох.');
assert.equal(necroViews.find(v=>v.spell.slug==='necrotic-bomb')?.rules.heightened?.['+1'],'Урон увеличивается на 1d12.');
assert.ok(source('../src/features/spell-library/load-catalog.ts').includes('pf2e-necromancer.json'),'Shared loader merges class spell pack');
assert.ok(page.includes('Классы заклинаний')&&page.includes('Все классы'),
  'The Necromancer class must have a visible quick-selection row');
console.log('PASS: Necromancer 10 remaster grave spells, Russian cards, class filter, focus resources');

const routeId='550e8400-e29b-41d4-a716-446655440000';
for(const base of ['/','/At-your-service/']){
  for(const route of [{kind:'characters'},{kind:'library'},{kind:'character',id:routeId}]){
    const path=siteRoutePath(route,base);
    assert.ok(!path.includes('#'));
    assert.deepEqual(parseSiteRoute(path,base),route);
  }
}
assert.deepEqual(parseSiteRoute('#library'),{kind:'library'});
assert.deepEqual(parseSiteRoute('/character/invalid/'),{kind:'characters'});

const clericPack=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave1.json')),'pf2e');
assert.equal(clericPack.spells.length,10,'The first staged Cleric domain import contains ten spells');
assert.equal(clericPack.spells.filter(x=>x.kind==='focus').length,10);
assert.equal(clericPack.spells.filter(x=>x.rank===1).length,5);
assert.equal(clericPack.spells.filter(x=>x.rank===4).length,5);
assert.ok(clericPack.spells.every(x=>x.classes.includes('cleric')&&x.traditions.length===0));
assert.ok(clericPack.spells.every(x=>x.subclass?.type==='domain'&&x.subclass.name));
assert.equal(new Set(clericPack.spells.map(x=>x.subclass.name)).size,5);
assert.ok(clericPack.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
assert.ok(clericPack.translations.filter(x=>x.locale==='ru').every(x=>x.description.length>100));
assert.equal(spellSubclassLabel(clericPack.spells.find(x=>x.slug==='agile-feet')),
  'Домен — Путешествия');
assert.equal(filterSpellViews(toSpellViews(clericPack,'pf2e-remaster'),
  {...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,10);
assert.equal(filterSpellViews(toSpellViews(clericPack,'pf2e-remaster'),
  {...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0,
  'Cleric domain spells must not leak into unrestricted Divine tradition');
const clericPackB=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave1b.json')),'pf2e');
assert.equal(clericPackB.spells.length,10,'Second batch of the first cleric wave must have ten spells');
assert.equal(clericPackB.spells.filter(x=>x.rank===1).length,5);
assert.equal(clericPackB.spells.filter(x=>x.rank===4).length,5);
assert.equal(clericPackB.versions.filter(x=>x.rules?.resource==='spell-slot').length,0);
assert.ok(clericPackB.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
assert.ok(clericPackB.spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')
  &&x.traditions.length===0&&x.subclass?.type==='domain'&&x.subclass.name));
assert.equal(new Set(clericPackB.spells.map(x=>x.subclass.name)).size,5);
assert.equal(new Set([...clericPack.spells,...clericPackB.spells].map(x=>x.id)).size,20);
assert.equal(new Set([...clericPack.spells,...clericPackB.spells].map(x=>x.slug)).size,20);
assert.ok(clericPackB.translations.filter(x=>x.locale==='ru')
  .every(x=>x.description.length>130&&x.translationOrigin==='at-your-service'));
assert.equal(spellSubclassLabel(clericPackB.spells.find(x=>x.slug==='localized-quake')),
  'Домен — Земля');
const clericViewsB=toSpellViews(clericPackB,'pf2e-remaster');
assert.equal(filterSpellViews(clericViewsB,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,10);
assert.equal(filterSpellViews(clericViewsB,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0);
assert.equal(clericViewsB.find(x=>x.spell.slug==='flame-barrier').rules.cast.time,'Реакция');
assert.equal(clericViewsB.find(x=>x.spell.slug==='localized-quake').rules.outcomes.criticalFailure,
  'Двойной дробящий урон и падение ничком.');
assert.equal(clericViewsB.find(x=>x.spell.slug==='fire-ray').rules.heightened['+1'],
  'Начальный урон +2d6; продолжительный урон при критическом успехе +1d4.');
const clericPackC=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave1c.json')),'pf2e');
const threeClericPacks=[clericPack,clericPackB,clericPackC];
assert.equal(clericPackC.spells.length,10,'Third batch of first Cleric wave contains ten cards');
assert.equal(clericPackC.spells.filter(x=>x.rank===1).length,5);
assert.equal(clericPackC.spells.filter(x=>x.rank===4).length,5);
assert.equal(clericPackC.versions.length,10);
assert.equal(clericPackC.translations.filter(x=>x.locale==='ru').length,10);
assert.ok(clericPackC.spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')
  &&x.traditions.length===0&&x.subclass?.type==='domain'&&x.subclass.name.trim()));
assert.equal(new Set(clericPackC.spells.map(x=>x.subclass.name)).size,5);
assert.ok(clericPackC.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
assert.ok(clericPackC.translations.filter(x=>x.locale==='ru')
  .every(x=>x.translationOrigin==='at-your-service'&&x.description.length>180));
assert.equal(clericPackC.translations.filter(x=>x.locale==='en').length,10,
  'Original English names are retained separately');
const allClericSpells=threeClericPacks.flatMap(x=>x.spells);
assert.equal(allClericSpells.length,30);
assert.equal(new Set(allClericSpells.map(x=>x.id)).size,30,'Unique IDs across Cleric packs');
assert.equal(new Set(allClericSpells.map(x=>x.slug)).size,30,'No duplicated English spell identities');
assert.equal(new Set(allClericSpells.map(x=>x.subclass.name)).size,15,'Exactly fifteen Cleric domains');
assert.equal(spellSubclassLabel(clericPackC.spells.find(x=>x.slug==='positive-luminance')),
  'Домен — Солнце');
const clericViewsC=toSpellViews(clericPackC,'pf2e-remaster');
assert.equal(filterSpellViews(clericViewsC,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,10);
assert.equal(filterSpellViews(clericViewsC,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0,
  'Class-specific focus spells must not leak into the Divine tradition');
assert.equal(clericViewsC.find(x=>x.spell.slug==='pushing-gust')?.rules.range,'500 футов');
assert.equal(clericViewsC.find(x=>x.spell.slug==='pushing-gust')?.rules.outcomes.success,
  'Цель отталкивается на 5 футов от вас.');
assert.equal(clericViewsC.find(x=>x.spell.slug==='disperse-into-air')?.rules.cast.time,'Реакция');
assert.equal(clericViewsC.find(x=>x.spell.slug==='protectors-sacrifice')?.rules.cast.time,'Реакция');
assert.equal(clericViewsC.find(x=>x.spell.slug==='downpour')?.rules.heightened['+1'],
  'Сопротивление огню увеличивается на 2.');
const combinedClericViews=threeClericPacks.flatMap(x=>toSpellViews(x,'pf2e-remaster'));
assert.deepEqual(availableGrimoireClasses(combinedClericViews,['cleric','necromancer']),
  [{id:'cleric',count:30}],'Selected Cleric has thirty class-specific spells in Grimoire');
assert.equal(filterGrimoireEntries(combinedClericViews,'all','all','',new Map(),'cleric').length,30);
assert.equal(filterGrimoireEntries(combinedClericViews,1,'all','',new Map(),'cleric').length,15);
assert.equal(filterGrimoireEntries(combinedClericViews,4,'all','',new Map(),'cleric').length,15);
assert.equal(filterGrimoireEntries(combinedClericViews,'all','all','',new Map(),'necromancer').length,0);
const clericPackD=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave1d.json')),'pf2e');
assert.equal(clericPackD.spells.length,8,'Fourth Cleric batch must contain eight spells');
assert.equal(clericPackD.spells.filter(x=>x.rank===1).length,4);
assert.equal(clericPackD.spells.filter(x=>x.rank===4).length,4);
assert.ok(clericPackD.spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')&&
  x.traditions.length===0&&x.subclass?.type==='domain'));
assert.ok(clericPackD.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
assert.ok(clericPackD.translations.filter(x=>x.locale==='ru')
  .every(x=>x.translationOrigin==='at-your-service'&&x.description.length>180));
assert.equal(clericPackD.translations.filter(x=>x.locale==='en').length,8);
assert.equal(new Set(clericPackD.spells.map(x=>x.subclass.name)).size,4);
const fourClericPacks=[clericPack,clericPackB,clericPackC,clericPackD];
const allClericSpellsD=fourClericPacks.flatMap(pack=>pack.spells);
assert.equal(allClericSpellsD.length,38);
assert.equal(new Set(allClericSpellsD.map(x=>x.id)).size,38,'No duplicate Cleric spell IDs');
assert.equal(new Set(allClericSpellsD.map(x=>x.slug)).size,38,'No duplicate Cleric spell slugs');
assert.equal(new Set(allClericSpellsD.map(x=>x.subclass.name)).size,19,'Exactly 19 distinct domains');
assert.equal(spellSubclassLabel(clericPackD.spells.find(x=>x.slug==='moonbeam')),'Домен — Луна');
const clericViewsD=toSpellViews(clericPackD,'pf2e-remaster');
assert.equal(filterSpellViews(clericViewsD,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,8);
assert.equal(filterSpellViews(clericViewsD,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0);
const moon=clericViewsD.find(x=>x.spell.slug==='moonbeam');
assert.equal(moon.rules.edition,'pf2e-legacy');
assert.match(moon.description,/1d6/,'Legacy Moonbeam base is 1d6, not Remaster 2d6');
assert.equal(moon.rules.heightened['+1'],'Урон увеличивается на 1d6.');
assert.equal(clericViewsD.find(x=>x.spell.slug==='delusional-pride').rules.outcomes.criticalFailure,
  'Длится 24 часа.');
assert.equal(clericViewsD.find(x=>x.spell.slug==='splash-of-art').rules.cast.actions,2);
const allClericViewsD=fourClericPacks.flatMap(pack=>toSpellViews(pack,'pf2e-remaster'));
assert.deepEqual(availableGrimoireClasses(allClericViewsD,['cleric','necromancer']),
  [{id:'cleric',count:38}]);
assert.equal(filterGrimoireEntries(allClericViewsD,'all','all','',new Map(),'cleric').length,38);
assert.equal(filterGrimoireEntries(allClericViewsD,1,'all','',new Map(),'cleric').length,19);
assert.equal(filterGrimoireEntries(allClericViewsD,4,'all','',new Map(),'cleric').length,19);
assert.equal(filterGrimoireEntries(allClericViewsD,'all','all','',new Map(),'necromancer').length,0);
const clericPackE=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave1e.json')),'pf2e');
assert.equal(clericPackE.spells.length,8,'First Cleric wave final batch contains eight spells');
assert.equal(clericPackE.spells.filter(x=>x.rank===1).length,4);
assert.equal(clericPackE.spells.filter(x=>x.rank===4).length,4);
assert.equal(clericPackE.versions.filter(x=>x.cast?.time==='Реакция').length,2,
  'Unity and Zeal for Battle are reactions, not ordinary actions');
assert.ok(clericPackE.spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')&&
  x.traditions.length===0&&x.subclass?.type==='domain'&&x.subclass.name));
assert.ok(clericPackE.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
assert.ok(clericPackE.translations.filter(x=>x.locale==='ru').every(x=>
  x.translationOrigin==='at-your-service'&&x.description.length>150&&x.name.length>3));
assert.equal(clericPackE.translations.filter(x=>x.locale==='en').length,8);
const clericWave1Packs=[clericPack,clericPackB,clericPackC,clericPackD,clericPackE];
const allClericWave1Spells=clericWave1Packs.flatMap(x=>x.spells);
const allClericWave1Versions=clericWave1Packs.flatMap(x=>x.versions);
const allClericWave1Ru=clericWave1Packs.flatMap(x=>x.translations.filter(t=>t.locale==='ru'));
assert.equal(allClericWave1Spells.length,46,'First wave target complete: 46 spell cards');
assert.equal(new Set(allClericWave1Spells.map(x=>x.id)).size,46,'No repeated IDs across waves');
assert.equal(new Set(allClericWave1Spells.map(x=>x.slug)).size,46,'No repeated English identities across waves');
assert.equal(new Set(allClericWave1Versions.map(x=>x.id)).size,46,'No repeated versions');
assert.equal(allClericWave1Ru.length,46,'Every Cleric focus spell has a Russian description');
assert.equal(new Set(allClericWave1Ru.map(x=>x.spellId)).size,46,'Exactly one Russian card per spell');
assert.ok(allClericWave1Ru.every(x=>x.description.length>100&&x.name.length>2));
assert.ok(allClericWave1Spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')&&
  x.traditions.length===0&&x.subclass?.type==='domain'&&x.subclass.name));
assert.ok(allClericWave1Versions.every(x=>x.resource==='focus-point'&&x.edition==='pf2e-legacy'));
const domains=allClericWave1Spells.reduce((group,spell)=>{
  const name=spell.subclass.name;group.set(name,[...(group.get(name)??[]),spell.rank]);return group;
},new Map());
assert.equal(domains.size,23,'First wave covers 23 unique domains');
for(const [name,ranks] of domains)assert.deepEqual(ranks.sort((a,b)=>a-b),[1,4],
  'Every domain must have one initial and one advanced focus spell: '+name);
const clericWave1Views=clericWave1Packs.flatMap(x=>toSpellViews(x,'pf2e-remaster'));
assert.deepEqual(availableGrimoireClasses(clericWave1Views,['cleric','necromancer']),
  [{id:'cleric',count:46}]);
assert.equal(filterGrimoireEntries(clericWave1Views,'all','all','',new Map(),'cleric').length,46);
assert.equal(filterGrimoireEntries(clericWave1Views,1,'all','',new Map(),'cleric').length,23);
assert.equal(filterGrimoireEntries(clericWave1Views,4,'all','',new Map(),'cleric').length,23);
assert.equal(filterGrimoireEntries(clericWave1Views,'all','all','',new Map(),'necromancer').length,0);
assert.equal(filterSpellViews(clericWave1Views,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,46);
assert.equal(filterSpellViews(clericWave1Views,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0,
  'Domain magic must not become ordinary divine tradition spells');
assert.equal(spellSubclassLabel(clericPackE.spells.find(x=>x.slug==='unity')),'Домен — Семья');
const dtor=slug=>clericPackE.versions.find(v=>v.spellId==='pf2e-cleric-domain-'+slug);
assert.equal(dtor('cry-of-destruction')?.cast?.actions,2);
assert.equal(dtor('cry-of-destruction')?.heightened?.['+1'],'Базовый урон звуком увеличивается на 1d8.');
assert.equal(dtor('destructive-aura')?.heightened?.['+2'],'Сопротивления существ в области уменьшаются ещё на 2.');
assert.equal(dtor('soothing-words')?.heightened?.['5'],
  'Бонус состояния к спасброскам Воли увеличивается до +2, а против эффектов эмоций — до +3.');
assert.equal(dtor('unity')?.cast?.time,'Реакция');
assert.equal(dtor('magics-vessel')?.duration,'Поддерживаемое, до 1 минуты');
assert.equal(dtor('mystic-beacon')?.cast?.actions,1);
assert.equal(dtor('weapon-surge')?.cast?.actions,1);
assert.equal(dtor('zeal-for-battle')?.cast?.time,'Реакция');
console.log('PASS: Cleric wave 1 audited: 46 Russian cards, 23 domains, 23 initial + 23 advanced, no duplicates, filters and focus-point resources');
const clericPack2a=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave2a.json')),'pf2e');
assert.equal(clericPack2a.spells.length,8,'Second Cleric wave first batch has eight spells');
assert.equal(clericPack2a.spells.filter(s=>s.rank===1).length,4);
assert.equal(clericPack2a.spells.filter(s=>s.rank===4).length,4);
assert.ok(clericPack2a.versions.every(v=>v.edition==='pf2e-legacy'&&v.resource==='focus-point'));
assert.ok(clericPack2a.spells.every(s=>s.kind==='focus'&&s.traditions.length===0&&
  s.classes.length===1&&s.classes[0]==='cleric'&&s.subclass?.type==='domain'&&s.subclass.name));
assert.ok(clericPack2a.translations.filter(t=>t.locale==='ru').every(t=>
  t.translationOrigin==='at-your-service'&&t.description.length>200&&t.name.length>4));
assert.equal(clericPack2a.translations.filter(t=>t.locale==='ru').length,8);
assert.equal(new Set(clericPack2a.spells.map(s=>s.subclass.name)).size,4);
const allClericSpellsNow=[...allClericWave1Spells,...clericPack2a.spells];
assert.equal(allClericSpellsNow.length,54);
assert.equal(new Set(allClericSpellsNow.map(s=>s.id)).size,54,'No cross-wave duplicate IDs');
assert.equal(new Set(allClericSpellsNow.map(s=>s.slug)).size,54,'No cross-wave duplicate slugs');
assert.equal(new Set(allClericSpellsNow.map(s=>s.subclass.name)).size,27);
const domainCounts2=new Map();
for(const spell of allClericSpellsNow){
  const key=spell.subclass.name;
  domainCounts2.set(key,[...(domainCounts2.get(key)??[]),spell.rank]);
}
for(const [domain,ranks] of domainCounts2)
  assert.deepEqual(ranks.sort((a,b)=>a-b),[1,4],'Domain rank pair missing: '+domain);
const clericView2a=toSpellViews(clericPack2a,'pf2e-remaster');
const combinedClericViews2=[...clericWave1Views,...clericView2a];
assert.equal(filterSpellViews(combinedClericViews2,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,54);
assert.equal(filterSpellViews(combinedClericViews2,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0);
assert.deepEqual(availableGrimoireClasses(combinedClericViews2,['cleric','necromancer']),[{id:'cleric',count:54}]);
assert.equal(filterGrimoireEntries(combinedClericViews2,'all','all','',new Map(),'cleric').length,54);
assert.equal(filterGrimoireEntries(combinedClericViews2,1,'all','',new Map(),'cleric').length,27);
assert.equal(filterGrimoireEntries(combinedClericViews2,4,'all','',new Map(),'cleric').length,27);
assert.equal(filterGrimoireEntries(combinedClericViews2,'all','all','',new Map(),'necromancer').length,0);
assert.equal(spellSubclassLabel(clericPack2a.spells.find(s=>s.slug==='read-fate')),'Домен — Судьба');
const rules2a=slug=>clericPack2a.versions.find(v=>v.spellId==='pf2e-cleric-domain-'+slug);
assert.equal(rules2a('read-fate').cast.time,'1 минута','Read Fate is one-minute cast');
assert.equal(rules2a('pulse-of-the-city').cast.actions,3,'Pulse of the City uses three actions');
assert.equal(rules2a('tempt-fate').cast.time,'Реакция');
assert.equal(rules2a('tempt-fate').range,'120 футов');
assert.equal(rules2a('tempt-fate').heightened['8'],'Бонус состояния к спасброску увеличивается до +2.');
assert.equal(rules2a('competitive-edge').heightened['7'],
  'Основной бонус состояния становится +2, усиленный при критическом успехе врага — +4.');
assert.equal(rules2a('face-in-the-crowd').heightened['3'],'Дистанция 10 футов; можно выбрать целями до 10 существ.');
assert.equal(rules2a('blind-ambition').outcomes.criticalSuccess,'Эффекта нет.');
assert.ok(rules2a('dreamers-call').outcomes.criticalFailure.includes('все возможные действия'));
console.log('PASS: Cleric second wave 2a: 54 unique focus spells in 27 domains; reaction, minute cast, class-only grimoire and legacy rules');
const clericPack2b=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave2b.json')),'pf2e');
assert.equal(clericPack2b.spells.length,8,'Cleric 2B has eight spells');
assert.equal(clericPack2b.spells.filter(x=>x.rank===1).length,4);
assert.equal(clericPack2b.spells.filter(x=>x.rank===4).length,4);
assert.equal(new Set(clericPack2b.spells.map(x=>x.subclass.name)).size,4);
assert.ok(clericPack2b.spells.every(x=>x.kind==='focus'&&x.classes.includes('cleric')
  &&x.classes.length===1&&x.traditions.length===0&&x.subclass?.type==='domain'));
assert.ok(clericPack2b.versions.every(x=>x.resource==='focus-point'&&x.edition==='pf2e-legacy'));
const ru2b=clericPack2b.translations.filter(x=>x.locale==='ru');
assert.equal(ru2b.length,8,'All eight spells have a Russian translation');
assert.ok(ru2b.every(x=>x.translationOrigin==='at-your-service'&&x.description.length>240));
const clericSpells2b=[...allClericSpellsNow,...clericPack2b.spells];
assert.equal(clericSpells2b.length,62,'46 first wave + 8 2A + 8 2B = 62');
assert.equal(new Set(clericSpells2b.map(x=>x.id)).size,62,'No duplicate ID across Cleric packs');
assert.equal(new Set(clericSpells2b.map(x=>x.slug)).size,62,'No duplicate English spell identities');
assert.equal(new Set(clericSpells2b.map(x=>x.subclass.name)).size,31,'31 covered domains');
const domainPairs2b=new Map();
for(const s of clericSpells2b){const n=s.subclass.name;domainPairs2b.set(n,[...(domainPairs2b.get(n)??[]),s.rank]);}
for(const [n,ranks] of domainPairs2b)assert.deepEqual(ranks.sort((a,b)=>a-b),[1,4],n);
const views2b=toSpellViews(clericPack2b,'pf2e-remaster');
const mergedClericViews2b=[...combinedClericViews2,...views2b];
assert.equal(filterSpellViews(mergedClericViews2b,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,62);
assert.equal(filterSpellViews(mergedClericViews2b,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0);
assert.deepEqual(availableGrimoireClasses(mergedClericViews2b,['cleric','necromancer']),
  [{id:'cleric',count:62}]);
assert.equal(filterGrimoireEntries(mergedClericViews2b,'all','all','',new Map(),'cleric').length,62);
assert.equal(filterGrimoireEntries(mergedClericViews2b,1,'all','',new Map(),'cleric').length,31);
assert.equal(filterGrimoireEntries(mergedClericViews2b,4,'all','',new Map(),'cleric').length,31);
const rule2b=slug=>clericPack2b.versions.find(v=>v.spellId==='pf2e-cleric-domain-'+slug);
const spell2b=slug=>clericPack2b.spells.find(s=>s.slug===slug);
assert.equal(rule2b('retributive-pain').cast.time,'Реакция');
assert.equal(rule2b('retributive-pain').savingThrow,'Обычный спасбросок Стойкости');
assert.equal(rule2b('retributive-pain').outcomes.criticalFailure,'Двойной отражённый ментальный урон.');
assert.equal(rule2b('natures-bounty').cast.actions,1);
assert.equal(rule2b('natures-bounty').heightened['+1'],
  'Лечение увеличивается на 6 ПЗ за каждый дополнительный круг.');
assert.equal(rule2b('vibrant-thorns').heightened['+1'],
  'Обычный ответный урон +1, ответный урон после позитивного заклинания +1d6.');
assert.equal(rule2b('savor-the-sting').cast.actions,1);
assert.equal(rule2b('savor-the-sting').savingThrow,'Воля');
assert.ok(!spell2b('savor-the-sting').traits.includes('attack'),
  'Legacy errata removed attack trait from Savor the Sting');
assert.equal(rule2b('waking-nightmare').outcomes.criticalFailure,
  'Испуган 3; если цель была без сознания, она просыпается и бежит 1 раунд.');
assert.ok(spell2b('shared-nightmare').traits.includes('incapacitation'));
assert.equal(rule2b('shared-nightmare').outcomes.criticalSuccess,
  'Заклинатель получает замешательство на 1 раунд.');
assert.equal(rule2b('take-its-course').heightened['7'],
  'Разрешено обработать любое число подходящих недугов и случаев продолжительного урона ядом на цели.');
assert.equal(spellSubclassLabel(spell2b('overstuff')),'Домен — Потворство');
console.log('PASS: Cleric wave 2B: 62 unique spells, 31 Legacy domains, complete RU, resource + reaction + saves + class filters');
const clericPack2c=parseSpellCatalog(JSON.parse(source('../public/spell-library/pf2e-cleric-wave2c.json')),'pf2e');
assert.equal(clericPack2c.spells.length,6,'Wave 2C adds six domain focus spells');
assert.equal(clericPack2c.spells.filter(x=>x.rank===1).length,3);
assert.equal(clericPack2c.spells.filter(x=>x.rank===4).length,3);
assert.equal(new Set(clericPack2c.spells.map(x=>x.subclass.name)).size,3);
assert.ok(clericPack2c.spells.every(x=>x.kind==='focus'&&x.classes.length===1
  &&x.classes.includes('cleric')&&x.traditions.length===0&&x.subclass?.type==='domain'));
assert.ok(clericPack2c.versions.every(x=>x.edition==='pf2e-legacy'&&x.resource==='focus-point'));
const ru2c=clericPack2c.translations.filter(x=>x.locale==='ru');
assert.equal(ru2c.length,6,'Six Russian translations');
assert.ok(ru2c.every(x=>x.translationOrigin==='at-your-service'&&x.description.length>225));
assert.equal(clericPack2c.translations.filter(x=>x.locale==='en').length,6);
const allClericSpells2c=[...clericSpells2b,...clericPack2c.spells];
const allClericVersions2c=[...clericWave1Packs.flatMap(x=>x.versions),
  ...clericPack2a.versions,...clericPack2b.versions,...clericPack2c.versions];
assert.equal(allClericSpells2c.length,68);
assert.equal(new Set(allClericSpells2c.map(x=>x.id)).size,68,'Unique IDs across Cleric waves');
assert.equal(new Set(allClericSpells2c.map(x=>x.slug)).size,68,'Unique spell slugs');
assert.equal(new Set(allClericVersions2c.map(x=>x.id)).size,68,'Unique version IDs');
assert.equal(new Set(allClericSpells2c.map(x=>x.subclass.name)).size,34,'34 different Legacy domains');
const wave2cPairs=new Map();
for(const spell of allClericSpells2c){
 const domain=spell.subclass.name;
 wave2cPairs.set(domain,[...(wave2cPairs.get(domain)??[]),spell.rank]);
}
for(const [domain,ranks] of wave2cPairs)
  assert.deepEqual(ranks.sort((a,b)=>a-b),[1,4],'Initial and advanced spell for '+domain);
const clericViews2c=toSpellViews(clericPack2c,'pf2e-remaster');
const allClericViews2c=[...mergedClericViews2b,...clericViews2c];
assert.equal(filterSpellViews(allClericViews2c,{...DEFAULT_SPELL_FILTERS,className:'cleric'}).length,68);
assert.equal(filterSpellViews(allClericViews2c,{...DEFAULT_SPELL_FILTERS,tradition:'divine'}).length,0,
  'Class focus spells must not leak into the unrestricted Divine tradition');
assert.deepEqual(availableGrimoireClasses(allClericViews2c,['cleric','necromancer']),
  [{id:'cleric',count:68}]);
assert.equal(filterGrimoireEntries(allClericViews2c,'all','all','',new Map(),'cleric').length,68);
assert.equal(filterGrimoireEntries(allClericViews2c,1,'all','',new Map(),'cleric').length,34);
assert.equal(filterGrimoireEntries(allClericViews2c,4,'all','',new Map(),'cleric').length,34);
assert.equal(filterGrimoireEntries(allClericViews2c,'all','',new Map(),'necromancer').length,0);
const spell2c=slug=>clericPack2c.spells.find(x=>x.slug===slug);
const rules2c=slug=>clericPack2c.versions.find(x=>x.spellId==='pf2e-cleric-domain-'+slug);
assert.equal(spellSubclassLabel(spell2c('charming-touch')),'Домен — Страсть');
assert.equal(spellSubclassLabel(spell2c('perfected-form')),'Домен — Совершенство');
assert.equal(spellSubclassLabel(spell2c('safeguard-secret')),'Домен — Тайна');
assert.equal(rules2c('charming-touch').cast.actions,1);
assert.ok(spell2c('charming-touch').traits.includes('incapacitation'));
assert.equal(rules2c('charming-touch').outcomes.criticalFailure,
  'Отношение становится любезным; цель не может действовать враждебно против вас.');
assert.ok(!rules2c('charming-touch').heightened,
  'Correct Legacy errata: Charming Touch has no old 4th-rank humanoid heightening');
assert.equal(rules2c('captivating-adoration').cast.actions,2);
assert.equal(rules2c('captivating-adoration').area,'15-футовая эманация');
assert.equal(rules2c('captivating-adoration').heightened['+1'],
  'Размер эманации увеличивается на 15 футов.');
assert.equal(rules2c('perfected-mind').cast.actions,1);
assert.equal(rules2c('perfected-form').cast.time,'Реакция');
assert.ok(spell2c('perfected-form').traits.includes('fortune'));
assert.equal(rules2c('forced-quiet').cast.actions,2);
assert.equal(rules2c('forced-quiet').outcomes.criticalFailure,'Эффект действует 10 минут.');
assert.equal(rules2c('safeguard-secret').cast.time,'1 минута',
  'Safeguard Secret is a minute cast, not a one-action spell');
assert.equal(rules2c('safeguard-secret').duration,'1 час');
assert.ok(ru2c.find(x=>x.spellId==='pf2e-cleric-domain-safeguard-secret')
  .description.includes('бонус состояния +4'));
console.log('PASS: Cleric 2C: 68 unique focus spells, 34 Legacy domain pairs, actions/reaction/minute casting, full Russian rules, class-only filters');
const necroPack=JSON.parse(source('../public/spell-library/pf2e-necromancer.json'));
const requested=[];
const mockedFetch=async(url)=>{
  requested.push(url);
  const file=url.split('/').at(-1);
  const data={'pf2e.json':wave,'pf2e-necromancer.json':necroPack,'pf2e-cleric-wave1.json':clericPack,'pf2e-cleric-wave1b.json':clericPackB,'pf2e-cleric-wave1c.json':clericPackC,'pf2e-cleric-wave1d.json':clericPackD,'pf2e-cleric-wave1e.json':clericPackE,'pf2e-cleric-wave2a.json':clericPack2a,'pf2e-cleric-wave2b.json':clericPack2b,'pf2e-cleric-wave2c.json':clericPack2c,'dnd5e.json':dnd}[file];
  return {ok:Boolean(data),status:data?200:404,json:async()=>structuredClone(data)};
};
const shared=await loadSpellCatalog('pf2e',new AbortController().signal,'/At-your-service/',mockedFetch);
assert.equal(shared.spells.length,wave.spells.length+necroPack.spells.length+clericPack.spells.length+clericPackB.spells.length+clericPackC.spells.length+clericPackD.spells.length+clericPackE.spells.length+clericPack2a.spells.length+clericPack2b.spells.length+clericPack2c.spells.length);
assert.equal(shared.translations.length,wave.translations.length+necroPack.translations.length+clericPack.translations.length+clericPackB.translations.length+clericPackC.translations.length+clericPackD.translations.length+clericPackE.translations.length+clericPack2a.translations.length+clericPack2b.translations.length+clericPack2c.translations.length);
assert.deepEqual(requested,['/At-your-service/spell-library/pf2e.json','/At-your-service/spell-library/pf2e-necromancer.json','/At-your-service/spell-library/pf2e-cleric-wave1.json','/At-your-service/spell-library/pf2e-cleric-wave1b.json','/At-your-service/spell-library/pf2e-cleric-wave1c.json','/At-your-service/spell-library/pf2e-cleric-wave1d.json','/At-your-service/spell-library/pf2e-cleric-wave1e.json','/At-your-service/spell-library/pf2e-cleric-wave2a.json','/At-your-service/spell-library/pf2e-cleric-wave2b.json','/At-your-service/spell-library/pf2e-cleric-wave2c.json']);
assert.ok(!requested.some(x=>x.includes('cycle')),'Old localization overlays must not load');
const sharedDnd=await loadSpellCatalog('dnd5e',new AbortController().signal,'/',mockedFetch);
assert.equal(sharedDnd.spells.length,dnd.spells.length);
const duplicate=structuredClone(necroPack);
duplicate.spells.push(structuredClone(wave.spells[0]));
await assert.rejects(()=>loadSpellCatalog('pf2e',new AbortController().signal,'/',async(url)=>({
  ok:true,status:200,json:async()=>url.endsWith('pf2e-necromancer.json')?duplicate:wave
})),/Повторяющиеся/);
console.log('PASS: shared loader, no old overlays, class pack, duplicate protection');

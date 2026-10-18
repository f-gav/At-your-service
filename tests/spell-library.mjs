import {parseSiteRoute,siteRoutePath} from '../src/lib/routes.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,SPELL_SYSTEMS,
  emptySpellCatalog,parseSpellCatalog,toSpellViews,filterSpellViews,
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
assert.equal(wave.translations.filter(t=>t.locale==='ru').length,413,'259 initial + 154 rank-two Russian titles');
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
assert.equal(liveViews.filter(v=>v.locale==='ru').length,413);
assert.equal(liveViews.filter(v=>v.locale==='en').length,70);
const legacy=liveViews.filter(v=>v.rules.edition==='pf2e-legacy');
assert.deepEqual(legacy.filter(v=>v.spell.rank<=1).map(v=>v.spell.slug).sort(),["acid-splash","admonishing-ray","airburst","ancient-dust","animate-rope","aqueous-blast","buffeting-winds","celestial-accord","draw-ire","elysian-whimsy","exchange-image","fashionista","flashy-disappearance","flense","forge","friendfetch","ghost-sound","glowing-trail","gritty-wheeze","healing-plaster","helpful-steps","inkshot","inside-ropes","invoke-true-name","join-pasts","know-location","magic-stone","negate-aroma","nettleskin","overselling-flourish","personal-rain-cloud","purifying-icicle","putrefy-food-and-drink","ray-of-frost","scorching-blast","scouring-sand","shillelagh","shocking-grasp","snowball","swampcall","synchronize-steps","torturous-trauma","verdant-sprout","verminous-lure"]);
assert.equal(toSpellViews(wave,'pf2e-legacy').filter(v=>v.spell.rank<=1).length,44);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length===413);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'en'}).length===70);
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
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&t.translatorCredit?.includes('PF2.ru, найдено через модуль')).length,39);
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
const authoredRankTwo=liveViews.filter(v=>v.spell.rank===2&&v.translationOrigin==='at-your-service');
assert.equal(authoredRankOne.length,109,
  'Original first-party localizations and all 15 audited cantrips retain AYS attribution');
assert.equal(authoredRankTwo.length,154,
  'All 154 independently localized rank-two cards retain AYS attribution');
assert.equal(liveViews.filter(v=>v.translationOrigin==='at-your-service').length,263,
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
 assert.ok(view&&view.locale==='en'&&view.name===view.englishName,'Unverified Russian title must not be invented: '+slug);
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
 assert.ok(card&&card.locale==='en'&&card.name===card.englishName,'No invented translation: '+slug);
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
 assert.ok(card&&card.locale==='en'&&card.name===card.englishName,'Do not invent translations: '+slug);
 assert.equal(card.spell.rank,2,'Untranslated original rank 2: '+slug);
 assert.ok(rankTwoTracker.includes('| '+card.englishName+' |'),'English tracker includes '+slug);
}
const anomalous=liveViews.find(v=>v.spell.slug==='funeral-flames');
assert.ok(anomalous&&anomalous.spell.rank===1&&anomalous.locale==='en',
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
 assert.ok(view&&view.spell.rank===2&&view.locale==='en'&&view.name===view.englishName,'Wave 05 unverified Russian name not invented: '+slug);
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
 assert.ok(card&&card.spell.rank===2&&card.locale==='en'&&card.name===card.englishName,'No invented names: '+slug);
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
for(const slug of wave09en){const v=liveViews.find(v=>v.spell.slug===slug);assert.ok(v&&v.locale==='en'&&v.spell.rank===2,'Wave09 EN: '+slug);assert.ok(rankTwoTracker.includes('| '+v.englishName+' |'));}

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
 assert.ok(card&&card.spell.rank===2&&card.locale==='en'&&card.name===card.englishName,'Wave10 EN original: '+slug);
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
 assert.ok(view&&view.spell.rank===2&&view.locale==='en'&&view.name===view.englishName,'EN wave 08: '+slug);
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
assert.ok(page.includes('parseSpellCatalog(await response.json(),system)'));
assert.ok(page.includes('section===\'mine\''));
assert.ok(page.includes('rules.ritual===true'),'D&D ritual flag remains distinct');
assert.ok(page.includes('setSelectedId(spell.id)'),'Spell details work after later import');
console.log('PASS: PF2e 71 cantrips + 189 rank-one + 223 rank-two spells (413 RU/54 EN), tracker, Legacy, D&D untouched');

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
assert.ok(page.includes('pf2e-necromancer.json'),'React library merges new class spell pack');
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

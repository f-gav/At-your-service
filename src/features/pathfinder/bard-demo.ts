import type { EditableField } from './editor-schema';

/** UI-only sample for inspecting PF2e fields. Not saved or published.
 * Level 20 lets the fixture exercise every spell circle and advancement row.
 * Numbers and effects are illustrative; this is not a validated character build.
 */
const BARDS:Record<string,string> = {
  name:'Лираэль',player:'Тестовый игрок',level:'20',experience:'1000',
  ancestry:'Человек',background:'Артист',character_class:'Бард',
  heritage:'Разносторонний человек',size:'Средний',
  background_notes:'Выросла в театре столицы.',class_notes:'Муза маэстро. Магия музыки.',
  ability_str:'0',ability_dex:'+5',ability_con:'+5',
  ability_int:'+3',ability_wis:'+4',ability_cha:'+7',
  armor_dex:'+5',armor_prof:'+24',armor_item:'+3',armor_class:'42',
  shield_ac_bonus:'+2',shield_hardness:'5',shield_max_hp:'20',
  shield_broken:'10',shield_hp:'20',hp_max:'258',hp_current:'238',hp_temp:'12',
  dying:'0',wounded:'0',resistances:'Звук 5',conditions:'Воодушевлён',
  save_fort:'29',save_reflex:'31',save_will:'34',
  defense_notes:'Плащ защиты, усиленная кожаная броня.',
  skills_notes:'Особая область: древние песни.',
  languages:'Всеобщий, Эльфийский, Небесный, Гномий',
  perception:'30',perception_notes:'Чуткий слух и внимательный взгляд.',
  speed:'30',movement:'Ходьба 30 фт.',
  weapon_other:'Любимая лютня.',critical_effects:'Дополнительный урон звуком.',
  class_dc:'43',class_dc_key:'+7',class_dc_rank:'24',class_dc_item:'+2',
  ancestry_features:'Талант к импровизации',
  ancestry_feat_1:'Человеческая изобретательность',
  background_skill_feat:'Сценическое мастерство',
  class_features_1:'Муза маэстро.\nВдохновляющее выступление.\nОккультные заклинания.',
  inventory_held:'Лютня мастера\nМузыкальные ноты\nЖезл исцеления',
  inventory_held_bulk:'1\nЛ\nЛ',
  inventory_consumables:'Эликсир жизни × 3\nСвиток звука × 2',
  inventory_consumables_bulk:'Л\n—',
  inventory_worn:'Плащ артиста\nДоспех +3\nКольцо защиты',
  inventory_worn_attune:'Да\nНет\nДа',inventory_worn_bulk:'Л\n1\n—',
  bulk_total:'6',wealth_pp:'18',wealth_gp:'245',wealth_sp:'32',wealth_cp:'7',
  valuables:'Серебряная брошь\nСтаринная партитура\nСамоцветы',
  valuables_price:'45 зм\n150 зм\n300 зм',valuables_bulk:'Л\n—\nЛ',
  ethnicity:'Талданка',nationality:'Талдор',birthplace:'Оппара',
  age:'37',pronouns:'Она/её',height:'172 см',weight:'64 кг',
  appearance:'Каштановые волосы, лиловый плащ и лютня.',
  attitude:'Доброжелательная, остроумная.',
  deity:'Шелин',edicts:'Создавать красоту.\nПоддерживать искусство.',
  anathema:'Предавать друзей.\nУничтожать искусство.',
  likes:'Театр, баллады, чай',dislikes:'Ложь и жестокость',
  quotes:'«У каждой истории есть припев».',
  campaign_notes:'День 12. Нашли заброшенный театр.\nДень 13. Выучили древнюю песню.',
  allies:'Маэстро Геран\nТруппа артистов',
  enemies:'Хозяин теней\nМолчаливые охотники',
  organizations:'Коллегия музыкантов\nГильдия артистов',
  spell_attack:'36',spell_attack_rank:'24',spell_attack_key:'+7',
  spell_dc:'46',spell_dc_rank:'24',spell_dc_key:'+7',spell_dc_item:'+2',
  cantrips_daily:'5',cantrip_rank:'10',
  cantrip_names:'Обнаружение магии\nСвет\nЗвуковой удар\nЩит',
  cantrip_actions:'2\n1\n2\n1',cantrip_prepared:'Да\nДа\nДа\nДа',
  spellbook_left_names:'Успокоение\nНевидимость\nУскорение\nРассеивание магии\nВдохновение',
  spellbook_left_actions:'2\n2\n2\n2\n1',spellbook_left_ranks:'1\n2\n3\n4\n5',
  spellbook_left_prepared:'✓\n✓\n✓\n✓\n✓',
  spellbook_right_names:'Призрачный звук\nСон\nСмятение\nПредвидение\nГероизм',
  spellbook_right_actions:'2\n2\n2\n2\n2',spellbook_right_ranks:'1\n2\n4\n6\n7',
  spellbook_right_prepared:'✓\n✓\n✓\n✓\n✓',
  focus_rank:'10',focus_spells:'Вдохновляющая композиция\nМуза созидания',
  focus_actions:'1\n2',
  innate_spells:'Свет\nТелепатия',innate_actions:'1\n2',
  innate_frequency:'По желанию\n1/день',
  rituals_left_name:'Песнь памяти\nПризыв духа',
  rituals_left_rank:'2\n4',rituals_left_cost:'50 зм\n200 зм',
  rituals_right_name:'Обряд единения\nСвязь с музой',
  rituals_right_rank:'5\n7',rituals_right_cost:'300 зм\n500 зм',
};
const SKILLS:Record<string,[number,number]> = {
  acrobatics:[5,24],athletics:[0,22],thievery:[5,22],survival:[4,24],
  diplomacy:[7,28],intimidation:[7,26],lore1:[3,22],lore2:[3,22],
  performance:[7,28],medicine:[4,22],arcana:[3,24],deception:[7,28],
  society:[3,24],occultism:[3,28],nature:[4,22],religion:[4,22],
  crafting:[3,22],stealth:[5,24],
};
const WEAPONS:Record<number,[string,string,string,string]> = {
  1:['Рапира +3','+32','4d6+5','Точное, изящное'],
  2:['Короткий лук','+30','3d6+3','Дистанция 60 фт.'],
  3:['Кинжал','+28','2d4+4','Метательное'],
  4:['Посох маэстро','+29','3d4+3','Магический'],
  5:['Короткий меч','+30','3d6+4','Лёгкое'],
};
const ACTIONS = [
  ['Вдохновляющая композиция','1','Слуховой','350','Союзники получают бонус к атаке.'],
  ['Героическая песнь','1','Концентрация','351','Песня вдохновляет союзников.'],
  ['Звуковой удар','2','Звук','356','Волна звука поражает врага.'],
  ['Сценическая импровизация','2','Слуховой','352','Выступление отвлекает врагов.'],
];
const REACTIONS = [
  ['Контрмелодия','Слуховой','350','Вражеская магия','Ослабляет заклинание мелодией.'],
  ['Защитный аккорд','Магия','351','Союзник ранен','Песня поддерживает друга.'],
  ['Быстрая импровизация','Эмоция','352','Провалена проверка','Меняет интонацию.'],
  ['Своевременный припев','Слуховой','353','Помеха выступлению','Перекрывает шум.'],
];
function testToggle(id:string):string {
  if(id==='tradition_occult'||id==='spontaneous'||id==='hero_1'||id==='focus_point_1')return 'true';
  if(/^tradition_|^hero_|^focus_point_|^ability_.*_partial$/.test(id)||id==='prepared')return 'false';
  return 'true';
}
function valueFor(f:Pick<EditableField,'id'|'kind'|'label'|'options'>,i:number):string {
  const {id,kind,label}=f;
  if(kind==='toggle')return testToggle(id);
  if(kind==='select'){
    const desired=BARDS[id];
    return f.options?.includes(desired)?desired:f.options?.[0]??'';
  }
  if(Object.hasOwn(BARDS,id))return BARDS[id];
  const skill=/^skill_([a-z0-9]+)_(total|ability|prof|item|armor|rank)$/.exec(id);
  if(skill){
    const [ability,prof]=SKILLS[skill[1]]??[3,22];
    if(skill[2]==='ability')return (ability>=0?'+':'')+ability;
    if(skill[2]==='prof')return '+'+prof;
    if(skill[2]==='item')return skill[1]==='performance'?'+3':'+1';
    if(skill[2]==='armor')return '0';
    if(skill[2]==='rank')return skill[1]==='performance'?'4':'3';
    return String(ability+prof+(skill[1]==='performance'?3:1));
  }
  const save=/^save_(fort|reflex|will)_(rank|ability|prof|item)$/.exec(id);
  if(save){
    if(save[2]==='rank')return '3';
    if(save[2]==='ability')return save[1]==='will'?'+4':'+5';
    if(save[2]==='prof')return '+24';
    return '+1';
  }
  const weapon=/^weapon_([1-5])_(name|attack|damage|traits)$/.exec(id);
  if(weapon)return WEAPONS[Number(weapon[1])][['name','attack','damage','traits'].indexOf(weapon[2])];
  const rank=/^(armor_rank_|weapon_rank_)(\d+)$/.exec(id);
  if(rank)return rank[1]==='armor_rank_'?(rank[2]==='1'?'2':'1'):'3';
  const feat=/^(feat_level_|class_level_)(\d+)$/.exec(id);
  if(feat)return feat[1]==='feat_level_'?'Талант '+feat[2]+' ур.':'Навык барда '+feat[2];
  const action=/^action_([1-4])_(name|cost|traits|page|effect)$/.exec(id);
  if(action)return ACTIONS[Number(action[1])-1][['name','cost','traits','page','effect'].indexOf(action[2])];
  const reaction=/^reaction_([1-4])_(name|traits|page|condition|effect)$/.exec(id);
  if(reaction)return REACTIONS[Number(reaction[1])-1][['name','traits','page','condition','effect'].indexOf(reaction[2])];
  const slots=/^spell_(slots|remaining)_(\d+)$/.exec(id);
  if(slots)return slots[1]==='slots'?(slots[2]==='10'?'1':'3'):(slots[2]==='10'?'1':'2');
  if(/^perception_(rank|ability|prof|item)$/.test(id))
    return id.endsWith('rank')?'3':id.endsWith('ability')?'+4':id.endsWith('prof')?'+24':'+2';
  if(kind==='number'||kind==='counter')return String((i%12)+1);
  if(kind==='long')return label+': пример записи.\nЛираэль поддерживает отряд и поёт.';
  return id.startsWith('custom_')?'Пробная запись барда':label+': пример';
}
/** Full deterministic fixture even for user-created custom fields. */
export function buildBardDemo(fields:ReadonlyArray<Pick<EditableField,'id'|'label'|'kind'|'maxlen'|'options'>>):Record<string,string> {
  const result:Record<string,string>={};
  fields.forEach((f,i)=>{
    const value=valueFor(f,i);
    result[f.id]=f.maxlen===undefined?value:value.slice(0,f.maxlen);
  });
  return result;
}

/** Versioned, paper-layout-independent state for D&D 5e. */
export type DndEdition = '2014' | '2024';
export type AbilityId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES = ['str','dex','con','int','wis','cha'] as const;
export type Proficiency = 'none' | 'proficient' | 'expert';
export type DndBonus = { id:string; source:string; target:string; op:'add'|'base'|'override'|'multiply'|'min'|'max'|'advantage'|'disadvantage'; value?:number; priority?:number; active?:boolean };
export type AbilityScore = { score:number; manualModifierOverride?:number|null };
export type DndClassLevel={id:string;name:string;level:number;spellcasting?:'full'|'half'|'third'|'pact'|'none';subclass?:string};
export type DndResource={id:string;name:string;current:number;maximum:number;reset:'short'|'long'|'manual';formula?:string};
export type DndEffect={id:string;name:string;active:boolean;rounds?:number|null;condition?:string;notes?:string;bonuses?:DndBonus[]};
export type DndFeature={id:string;name:string;source:string;description:string;usesResourceId?:string;active?:boolean};
export type Dnd5eSheet = {
  schemaVersion:1; rulesEdition:DndEdition; layoutEdition:DndEdition;
  identity:{ name:string; level:number; className?:string; subclass?:string; species?:string; background?:string; xp?:number; player?:string };classes?:DndClassLevel[];features?:DndFeature[];
  abilities:Record<AbilityId,AbilityScore>;
  proficiencies:{ saves:Record<string,Proficiency>; skills:Record<string,Proficiency>; equipment:Record<string,string[]> };
  combat:{ hp:{current:number;maximumBase:number;temporary:number}; ac:{baseExpression:string;shieldEquipped:boolean;shieldBonus:number}; speed:{walkBase:string}; deathSaves:{successes:number;failures:number}; conditions:string[]; exhaustion:number; inspiration:boolean };
  attacks:{id:string;name:string;ability?:AbilityId;proficient?:boolean;attackFormula?:string;damageFormula?:string;notes?:string}[];
  content:{blocks:Record<string,string>};
  spellcasting:{defaultAbility:AbilityId|null;displayMode:'text'|'cards';slots:{normal:Record<string,{maximum:number;used:number}>;pact:Record<string,{maximum:number;used:number}>};spells:{id:string;name:string;level:number;source:string;prepared?:boolean;known?:boolean;inBook?:boolean;granted?:boolean;slotless?:boolean;notes?:string;description?:string;castingTime?:string;duration?:string;concentration?:boolean;ritual?:boolean}[]};
  inventory:{coins:{cp:number;sp:number;ep:number;gp:number;pp:number};items:Record<string,unknown>[];attuned:string[]};
  resources:DndResource[]; effects:DndEffect[]; bonuses:DndBonus[];
  presentation:{hiddenBlocks:string[];fontScale:number;printOptions:Record<string,unknown>};
  imports:{origin:'manual'|'ays-v1'|'ays-v2'|'lss-v2';unmapped:Record<string,unknown>;unresolvedSpells:string[]};
};
export function newDndSheet(name='Персонаж',rulesEdition:DndEdition='2014'):Dnd5eSheet {
  return {
    schemaVersion:1,rulesEdition,layoutEdition:rulesEdition,
    identity:{name,level:1},
    abilities:{str:{score:10},dex:{score:10},con:{score:10},int:{score:10},wis:{score:10},cha:{score:10}},
    proficiencies:{saves:{},skills:{},equipment:{}},
    combat:{hp:{current:1,maximumBase:1,temporary:0},ac:{baseExpression:'10+[DEX]',shieldEquipped:false,shieldBonus:2},speed:{walkBase:'30'},deathSaves:{successes:0,failures:0},conditions:[],exhaustion:0,inspiration:false},
    attacks:[],content:{blocks:{}},
    spellcasting:{defaultAbility:null,displayMode:'text',slots:{normal:{},pact:{}},spells:[]},
    inventory:{coins:{cp:0,sp:0,ep:0,gp:0,pp:0},items:[],attuned:[]},
    classes:[],features:[],resources:[],effects:[],bonuses:[],
    presentation:{hiddenBlocks:[],fontScale:1,printOptions:{}},
    imports:{origin:'manual',unmapped:{},unresolvedSpells:[]}
  };
}

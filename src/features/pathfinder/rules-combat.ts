import type { SheetValues } from './sheet-values';
import { isLevel, proficiencyBonus, readNumber, readRank } from './rules-core.ts';

const weaponIds = [1, 2, 3, 4, 5] as const;
export const WEAPON_IDS = weaponIds;
export const ARMOR_CATEGORIES = ['Без брони', 'Лёгкая броня', 'Средняя броня', 'Тяжёлая броня'] as const;
export const WEAPON_CATEGORIES = ['Безоружное', 'Простое', 'Воинское', 'Продвинутое', 'Прочее'] as const;

const n = (values: SheetValues, key: string) => readNumber(values[key]);
const text = (values: SheetValues, key: string) => String(values[key] ?? '').trim();
const flag = (values: SheetValues, key: string) => values[key] === 'true' || values[key] === true;
const signed = (n: number) => n > 0 ? '+' + n : String(n);
const integer = (n: number | undefined) => n !== undefined && Number.isInteger(n) && Number.isFinite(n) && Math.abs(n) <= 100000;
const add = (r: Record<string, string>, key: string, number: number | undefined, absolute=false) => {
  if (number !== undefined && Number.isFinite(number)) r[key] = absolute ? String(number) : signed(number);
};
export const isCombatAuto = (v: SheetValues, feature: string) => flag(v, 'combat_' + feature + '_enabled');
export const shieldBrokenThreshold = (max: number | undefined) =>
  max !== undefined && integer(max) && max >= 0 ? Math.floor(max / 2) : undefined;
export function shieldIsBroken(v: SheetValues): boolean {
  const hp = n(v, 'shield_hp');
  const threshold = shieldBrokenThreshold(n(v, 'shield_max_hp'));
  return hp !== undefined && (hp <= 0 || (threshold !== undefined && hp <= threshold));
}
export function shieldActive(v: SheetValues): boolean {
  return flag(v, 'combat_shield_raised') && !shieldIsBroken(v)
    && n(v, 'combat_shield_ac_bonus') !== undefined;
}
export type WeaponResult = { attack: number; second: number; third: number; damage: string; agile: boolean };
const dicePattern = /^([1-9]\d{0,1})d(4|6|8|10|12)$/i;

/** Weapon base statistics and the two MAP variants. Never infer weapon traits from a free-text name. */
export function weaponResult(v: SheetValues, i: number): WeaponResult | undefined {
  const level = isLevel(v.level);
  const kind = text(v, 'combat_weapon_' + i + '_kind');
  const category = n(v, 'combat_weapon_' + i + '_category');
  const isRanged = kind === 'ranged' || kind === 'thrown';
  if (level === undefined || !['melee','ranged','thrown'].includes(kind)
      || !integer(category) || category! < 0 || category! > 4) return undefined;

  const str = n(v, 'ability_str'), dex = n(v, 'ability_dex');
  const attackAttribute = isRanged
    ? dex : flag(v, 'combat_weapon_' + i + '_finesse') && dex !== undefined && str !== undefined
      ? Math.max(str,dex) : str;
  if (attackAttribute === undefined) return undefined;
  const rank = readRank(v['weapon_rank_' + category]) ?? 0;
  const attack = attackAttribute + proficiencyBonus(level,rank)
    + (n(v,'combat_weapon_' + i + '_item_attack') ?? 0)
    + (n(v,'combat_weapon_' + i + '_other_attack') ?? 0);

  const agile = flag(v,'combat_weapon_' + i + '_agile');
  const die = text(v, 'combat_weapon_' + i + '_dice');
  let damage = '';
  if (dicePattern.test(die)) {
    let attribute = 0;
    if (kind === 'melee' || kind === 'thrown') {
      if (str === undefined) return {attack,second:attack-(agile?4:5),third:attack-(agile?8:10),damage:'',agile};
      attribute = str;
    } else if (flag(v,'combat_weapon_' + i + '_propulsive')) {
      if (str === undefined) return {attack,second:attack-(agile?4:5),third:attack-(agile?8:10),damage:'',agile};
      attribute = str < 0 ? str : Math.floor(str/2);
    }
    const bonus = attribute + (n(v,'combat_weapon_' + i + '_other_damage') ?? 0);
    damage = die.toLowerCase() + (bonus === 0 ? '' : signed(bonus));
  }
  return {attack,second:attack-(agile?4:5),third:attack-(agile?8:10),damage,agile};
}

/**
 * Calculates ONLY explicitly enabled combat subsections.
 * Equipped armor, shield, ancestry HP and weapons must be configured by the player.
 * Numeric HP damage & recovery and temporary HP are always manual except for an explicit Shield Block action.
 */
export function calculateCombat(v: SheetValues): Record<string,string> {
  const result: Record<string,string> = {};
  const level = isLevel(v.level), dex = n(v,'ability_dex'), con = n(v,'ability_con');

  if (isCombatAuto(v,'armor') && level !== undefined && dex !== undefined) {
    const category = n(v,'combat_armor_category');
    const cap = n(v,'combat_armor_dex_cap');
    if (integer(category) && category! >= 0 && category! < 4
      && (category === 0 || cap !== undefined)) {
      const usedDex = cap !== undefined ? Math.min(dex, cap) : dex;
      const proficiency = proficiencyBonus(level,readRank(v['armor_rank_'+category])??0);
      const armorItem = n(v,'combat_armor_item_bonus') ?? 0;
      const extra = n(v,'combat_armor_other_ac') ?? 0;
      const shield = shieldActive(v) ? n(v,'combat_shield_ac_bonus') ?? 0 : 0;
      add(result,'armor_dex',usedDex);
      add(result,'armor_prof',proficiency);
      add(result,'armor_item',armorItem);
      add(result,'armor_class',10+usedDex+proficiency+armorItem+extra+shield,true);
      if (isCombatAuto(v,'armor_skill_penalty')) {
        const str=n(v,'ability_str');
        const penalty=n(v,'combat_armor_check_penalty');
        const requirement=n(v,'combat_armor_strength_requirement');
        if (category===0 || (str!==undefined && penalty!==undefined && requirement!==undefined)) {
          const amount=category===0 || (str!==undefined && str >= (requirement??0))
            ? 0 : Math.abs(penalty??0);
          for (const skill of ['acrobatics','athletics','stealth','thievery']) {
            add(result,'skill_'+skill+'_armor',-amount);
          }
        }
      }
    }
  }
  if (isCombatAuto(v,'shield')) {
    const threshold = shieldBrokenThreshold(n(v,'shield_max_hp'));
    if (threshold !== undefined) add(result,'shield_broken',threshold,true);
  }
  if (isCombatAuto(v,'hp') && level !== undefined && con !== undefined) {
    const ancestry = n(v,'combat_hp_ancestry'), classHp = n(v,'combat_hp_class');
    if (integer(ancestry) && integer(classHp) && ancestry!>=0 && classHp!>=0) {
      const perLevel = n(v,'combat_hp_extra_per_level')??0;
      const flat = n(v,'combat_hp_extra_flat')??0;
      if (integer(perLevel) && integer(flat)) add(result,'hp_max',
        Math.max(1,ancestry! + level*(classHp!+con+perLevel)+flat),true);
    }
  }
  for (const i of WEAPON_IDS) {
    if (!isCombatAuto(v,'weapon_'+i)) continue;
    const weapon = weaponResult(v,i);
    if (weapon) {
      add(result,'weapon_'+i+'_attack',weapon.attack);
      if (weapon.damage) result['weapon_'+i+'_damage'] = weapon.damage;
    }
  }
  return result;
}
export function isCombatComputedField(v: SheetValues,id:string): boolean {
  if (['armor_class','armor_dex','armor_prof','armor_item'].includes(id))
    return isCombatAuto(v,'armor');
  if (/^skill_(acrobatics|athletics|stealth|thievery)_armor$/.test(id))
    return isCombatAuto(v,'armor') && isCombatAuto(v,'armor_skill_penalty');
  if (id==='shield_broken') return isCombatAuto(v,'shield');
  if (id==='hp_max') return isCombatAuto(v,'hp');
  const match=/^weapon_([1-5])_(attack|damage)$/.exec(id);
  return !!match && isCombatAuto(v,'weapon_'+match[1]);
}
export function isCombatFeatureValue(id:string): boolean { return /^combat_/.test(id); }

/** Shield Block reduces damage by Hardness, then BOTH shield and character take the rest.
 *  Temporary HP protect only the character. This is an explicit click, never auto-triggered.
 */
export function applyShieldBlock(v: SheetValues, damage: number): SheetValues {
  if (!integer(damage) || damage < 0) throw new Error('Введите целое значение урона от 0.');
  if (!flag(v,'combat_can_shield_block') || !flag(v,'combat_shield_raised') || shieldIsBroken(v))
    throw new Error('Нельзя блокировать: проверь реакцию, поднятие и целостность щита.');
  const hard=n(v,'shield_hardness'),shieldHp=n(v,'shield_hp'),current=n(v,'hp_current');
  if (!integer(hard)||!integer(shieldHp)||!integer(current)||hard!<0)
    throw new Error('Для блока укажи твёрдость, ПЗ щита и текущие ПЗ персонажа.');
  const remaining=Math.max(0,damage-hard!);
  const temp=Math.max(0,n(v,'hp_temp')??0);
  const usedTemp=Math.min(remaining,temp);
  return {...v,
    shield_hp:String(Math.max(0,shieldHp!-remaining)),
    hp_current:String(Math.max(0,current!-(remaining-usedTemp))),
    ...(n(v,'hp_temp')!==undefined?{hp_temp:String(temp-usedTemp)}:{}),
  };
}


/**
 * Calculate the on-sheet armor values from the contextual armor editor when
 * the player has explicitly equipped an armor category. Never infer the
 * category, Dex cap or check penalty from a free-text item name.
 *
 * Without a configured suit, keep backward-compatible editing of the native
 * PDF's applied Dex, proficiency and item cells.
 */
export function nativeArmorIsEquipped(v: SheetValues): boolean {
  const category = n(v,'combat_armor_category');
  return flag(v,'combat_armor_enabled')
    && integer(category) && category! >= 0 && category! < ARMOR_CATEGORIES.length;
}

export function calculateNativeCombat(v: SheetValues): Record<string,string> {
  const result: Record<string,string> = {};
  if (nativeArmorIsEquipped(v)) {
    const level=isLevel(v.level);
    const dex=n(v,'ability_dex');
    const category=n(v,'combat_armor_category')!;
    const cap=n(v,'combat_armor_dex_cap');
    if (level !== undefined && dex !== undefined && (category === 0 || cap !== undefined)) {
      const usedDex=category === 0 || cap === undefined ? dex : Math.min(dex,cap);
      const proficiency=proficiencyBonus(level,readRank(v['armor_rank_'+category]) ?? 0);
      const item=n(v,'combat_armor_item_bonus') ?? 0;
      const other=n(v,'combat_armor_other_ac') ?? 0;
      add(result,'armor_dex',usedDex);
      add(result,'armor_prof',proficiency);
      add(result,'armor_item',item);
      add(result,'armor_class',10+usedDex+proficiency+item+other,true);
    }
    if (flag(v,'combat_armor_skill_penalty_enabled')) {
      const str=n(v,'ability_str');
      const checkPenalty=n(v,'combat_armor_check_penalty');
      const requirement=n(v,'combat_armor_strength_requirement');
      // No armor or a zero penalty needs no separate Strength requirement.
      if (category === 0 || checkPenalty === 0
          || (str !== undefined && checkPenalty !== undefined && requirement !== undefined)) {
        const amount=category === 0 || checkPenalty === 0 || str! >= requirement!
          ? 0 : Math.abs(checkPenalty!);
        for (const skill of ['acrobatics','athletics','stealth','thievery']) {
          add(result,'skill_'+skill+'_armor',-amount);
        }
      }
    }
  } else {
    const dex=n(v,'armor_dex');
    const prof=n(v,'armor_prof');
    const item=n(v,'armor_item');
    if (dex !== undefined && prof !== undefined && item !== undefined) {
      add(result,'armor_class',10+dex+prof+item,true);
    }
  }
  const threshold=shieldBrokenThreshold(n(v,'shield_max_hp'));
  if (threshold !== undefined) add(result,'shield_broken',threshold,true);
  return result;
}

export function isNativeCombatComputedField(id:string, v?:SheetValues): boolean {
  if (id === 'armor_class' || id === 'shield_broken') return true;
  if (!v || !nativeArmorIsEquipped(v)) return false;
  if (['armor_dex','armor_prof','armor_item'].includes(id)) return true;
  return flag(v,'combat_armor_skill_penalty_enabled')
    && /^skill_(acrobatics|athletics|stealth|thievery)_armor$/.test(id);
}

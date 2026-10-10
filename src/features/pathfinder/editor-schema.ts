import baseFields from './fields.json';
import { fieldBox } from './layout';
import type { PathfinderField } from './layout';
import { PF2E_SIZE_OPTIONS, validOptions } from './field-options';
import { TOGGLE_MODES, TOGGLE_SHAPES } from './toggle-shapes';

export type EditableField = PathfinderField & {
  adjusted?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  paddingX?: number;
  paddingY?: number;
};
export const TEMPLATE_KEY = 'pf2e';
export const PAGE_NAMES = ['Характеристики', 'Способности и снаряжение', 'Заметки и действия', 'Заклинания'];
/** The printed armor silhouette already contains the numeric armor_class field.
 * Remove redundant legacy text overlays and add one number in the shield
 * illustration. Stored character values and all other calibrated fields stay intact.
 */
export const EQUIPMENT_NUMBER_FIELDS: EditableField[] = [{
  id: 'shield_ac_bonus', label: 'Щит — числовое поле', page: 1,
  x: 95, y: 212, w: 21, h: 15, kind: 'number', maxlen: 8,
  fontSize: 12, textAlign: 'center', adjusted: true,
}];
export function withEquipmentNumberFields(fields: EditableField[]): EditableField[] {
  const retained = fields.filter(f => !['combat_armor_name', 'combat_shield_notes'].includes(f.id));
  const existing = new Set(retained.map(f => f.id));
  return [...retained, ...EQUIPMENT_NUMBER_FIELDS.filter(f => !existing.has(f.id)).map(f => ({...f}))];
}

export const DEFAULT_FIELDS: EditableField[] = withEquipmentNumberFields(
  (baseFields as PathfinderField[]).map(f => ({
    ...f, ...fieldBox(f), adjusted: true,
    ...(f.id === 'size' ? { kind: 'select' as const, options: [...PF2E_SIZE_OPTIONS] } : {}),
  })),
);
const types = ['text','long','number','counter','toggle','select'];
const fonts = ['Arial','Georgia','Verdana','Times New Roman','Courier New'];

export function validFields(value: unknown): value is EditableField[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 650) return false;
  const ids = new Set<string>();
  return value.every((f: unknown) => {
    if (!f || typeof f !== 'object') return false;
    const a = f as EditableField;
    if (typeof a.id !== 'string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(a.id) || ids.has(a.id)) return false;
    ids.add(a.id);
    return typeof a.label === 'string' && a.label.length <= 160 &&
      Number.isInteger(a.page) && a.page >= 1 && a.page <= 4 &&
      types.includes(a.kind) &&
      (a.kind !== 'select' || validOptions(a.options)) &&
      (a.options === undefined || validOptions(a.options)) &&
      [a.x,a.y,a.w,a.h].every(n => typeof n === 'number' && Number.isFinite(n)) &&
      a.w >= 3 && a.h >= 3 && a.x >= 0 && a.y >= 0 && a.x+a.w <= 601.1 && a.y+a.h <= 782.5 &&
      (a.fontSize === undefined || (a.fontSize >= 5 && a.fontSize <= 40)) &&
      (a.fontWeight === undefined || [400,500,600,700,800].includes(a.fontWeight)) &&
      (a.fontStyle === undefined || ['normal','italic'].includes(a.fontStyle)) &&
      (a.textUnderline === undefined || typeof a.textUnderline === 'boolean') &&
      (a.fontFamily === undefined || fonts.includes(a.fontFamily)) &&
      (a.textAlign === undefined || ['left','center','right'].includes(a.textAlign)) &&
      (a.color === undefined || /^#[0-9a-fA-F]{6}$/.test(a.color)) &&
      (a.paddingX === undefined || (a.paddingX >= 0 && a.paddingX <= 20)) &&
      (a.paddingY === undefined || (a.paddingY >= 0 && a.paddingY <= 20)) &&
      (a.underline === undefined || typeof a.underline === 'boolean') &&
      (a.toggleShape === undefined || (a.kind === 'toggle' && TOGGLE_SHAPES.includes(a.toggleShape))) &&
      (a.toggleMode === undefined || (a.kind === 'toggle' && TOGGLE_MODES.includes(a.toggleMode))) &&
      (a.toggleInsetX === undefined || (a.kind === 'toggle' && Number.isFinite(a.toggleInsetX) && a.toggleInsetX >= 0 && a.toggleInsetX <= 40)) &&
      (a.toggleInsetY === undefined || (a.kind === 'toggle' && Number.isFinite(a.toggleInsetY) && a.toggleInsetY >= 0 && a.toggleInsetY <= 40));
  });
}
export function cloneFields(fields: EditableField[]): EditableField[] {
  return fields.map(f => ({...f}));
}

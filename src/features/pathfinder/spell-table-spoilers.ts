import { fieldBox } from './layout.ts';
import type { EditableField } from './editor-schema';

/** The only three printed PF2e spell tables made from parallel text fields.
 * A spoiler can be authored in any column, but expands across the complete
 * table, leaving ordinary entries and the PDF artwork unchanged.
 */
export const PF_SPELL_TABLES = [
  ['cantrip_names','cantrip_actions','cantrip_prepared'],
  ['spellbook_left_names','spellbook_left_actions','spellbook_left_ranks','spellbook_left_prepared'],
  ['spellbook_right_names','spellbook_right_actions','spellbook_right_ranks','spellbook_right_prepared'],
] as const;

export type SpellTableSpan = { width: number; offset: number; columns: number[]; tracks: number[] };

export function spellTableSpan(field: EditableField, fields: readonly EditableField[]): SpellTableSpan | null {
  if (field.page !== 4 || field.kind !== 'long') return null;
  const members = PF_SPELL_TABLES.find(ids => (ids as readonly string[]).includes(field.id));
  if (!members) return null;
  const available = members.map(id => fields.find(f => f.id === id))
    .filter((f): f is EditableField => Boolean(f && f.kind === 'long' && f.page === 4));
  if (available.length < 2) return null;
  const boxes = available.map(fieldBox);
  const left = Math.min(...boxes.map(box => box.x));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const offset = fieldBox(field).x - left;
  if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return null;
  const starts=boxes.map(box=>box.x);
  const tracks=starts.map((x,i)=>(i+1<starts.length?starts[i+1]:right)-x);
  return { width: right-left, offset, columns: boxes.map(box => box.w), tracks };
}

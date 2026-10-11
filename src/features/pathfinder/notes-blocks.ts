import {PF_NOTES_CONTENT_KEY} from './page-order';

/** Fixed IDs live inside details.pathfinderSheet and survive JSON import/export.
 * Block 1 deliberately reuses the original single-notes field, so older
 * characters keep their existing text without a migration or a schema bump.
 */
export const PF_NOTES_BLOCK_COUNT = 6;
export const PF_NOTES_HEIGHT_MIN = 28;
export const PF_NOTES_HEIGHT_MAX = 76;
export const PF_NOTES_HEIGHT_STEP = 8;
export const PF_NOTES_HEIGHT_DEFAULT = 36;

function checkedIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= PF_NOTES_BLOCK_COUNT) {
    throw new RangeError('Unknown PF2e note block');
  }
  return index + 1;
}

export function noteBodyKey(index: number): string {
  return index === 0 ? PF_NOTES_CONTENT_KEY : `pf2e_notes_block_${checkedIndex(index)}`;
}

export function noteTitleKey(index: number): string {
  return `pf2e_notes_title_${checkedIndex(index)}`;
}

export function noteHeightKey(index: number): string {
  return `pf2e_notes_height_${checkedIndex(index)}`;
}

export function noteBlockTitle(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Заметки';
}

export function noteBlockHeight(raw: unknown): number {
  const parsed = typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return PF_NOTES_HEIGHT_DEFAULT;
  const snapped = PF_NOTES_HEIGHT_MIN +
    Math.round((parsed - PF_NOTES_HEIGHT_MIN) / PF_NOTES_HEIGHT_STEP) * PF_NOTES_HEIGHT_STEP;
  return Math.min(PF_NOTES_HEIGHT_MAX, Math.max(PF_NOTES_HEIGHT_MIN, snapped));
}

export function resizeNoteBlock(raw: unknown, delta: -1 | 1): string {
  const next = noteBlockHeight(raw) + delta * PF_NOTES_HEIGHT_STEP;
  return String(Math.max(PF_NOTES_HEIGHT_MIN, Math.min(PF_NOTES_HEIGHT_MAX, next)));
}

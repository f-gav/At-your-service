/**
 * Coordinates in the field schema are in original PDF points (top-left origin).
 * Keep the field data independent of layout tweaks and game rules.
 */
export const PDF_WIDTH = 600.945;
export const PDF_HEIGHT = 782.362;

export type FieldKind = 'text' | 'long' | 'number' | 'counter' | 'toggle' | 'select';

export type PathfinderField = {
  id: string;
  label: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FieldKind;
  maxlen?: number;
  options?: string[];
  min?: number;
  max?: number;
  adjusted?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  paddingX?: number;
  paddingY?: number;
};

/** Small alignment corrections without modifying the authoritative PDF coordinates. */
export function fieldBox(field: PathfinderField): Pick<PathfinderField, 'x' | 'y' | 'w' | 'h'> {
  if (field.adjusted) return { x:field.x, y:field.y, w:field.w, h:field.h };
  let { x, y, w, h } = field;

  // Page 2's feat labels are printed in the first line of each row.
  // Move the editable text slightly down into the blank part of the row.
  if (/^(feat_level_|class_level_)\d+$/.test(field.id)) y += 4;

  // A little breathing room inside the thin header fields.
  if (['name', 'player', 'ancestry', 'background', 'character_class'].includes(field.id)) {
    y += 0.8;
    h -= 1;
  }

  // Preserve the printed small headings above multiline writing areas.
  if (field.kind === 'long') {
    y += 1;
    h -= 1;
  }

  return { x, y, w, h };
}

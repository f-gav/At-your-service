import type { PathfinderField } from './layout';
import { isHeroPointId } from './field-options.ts';

export const TOGGLE_SHAPES = ['rectangle', 'square', 'circle', 'diamond', 'hexagon'] as const;
export const TOGGLE_MODES = ['check', 'fill'] as const;
export type ToggleShape = typeof TOGGLE_SHAPES[number];
export type ToggleMode = typeof TOGGLE_MODES[number];

/** Legacy fields without shape metadata retain their original behavior. */
export function toggleAppearance(field: Pick<PathfinderField,'id'|'toggleShape'|'toggleMode'|'toggleInsetX'|'toggleInsetY'>) {
  const hero = isHeroPointId(field.id);
  return {
    shape: field.toggleShape ?? (hero ? 'hexagon' : 'square'),
    mode: field.toggleMode ?? (hero ? 'fill' : 'check'),
    insetX: field.toggleInsetX ?? (hero ? 12 : 0),
    insetY: field.toggleInsetY ?? (hero ? 16 : 0),
  };
}

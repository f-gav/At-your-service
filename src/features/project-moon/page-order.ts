import type { MoonPage } from './model';

export const DEFAULT_MOON_ORDER: MoonPage[] = ['dossier', 'combat', 'equipment', 'about', 'notes'];
const KNOWN_MOON_PAGES = new Set<string>(DEFAULT_MOON_ORDER);

export function parseMoonOrder(raw: unknown): MoonPage[] {
  const provided = Array.isArray(raw) ? raw : [];
  const ordered: MoonPage[] = [];
  for (const item of provided) {
    if (typeof item === 'string' && KNOWN_MOON_PAGES.has(item) && !ordered.includes(item as MoonPage)) {
      ordered.push(item as MoonPage);
    }
  }
  // Legacy four-page sheets did not have equipment. Insert the new page after
  // combat without changing the relative order selected by the player.
  if (!ordered.includes('equipment')) {
    const combatIndex=ordered.indexOf('combat');
    ordered.splice(combatIndex<0?ordered.length:combatIndex+1,0,'equipment');
  }
  for (const item of DEFAULT_MOON_ORDER) if (!ordered.includes(item)) ordered.push(item);
  return ordered;
}

export function moveMoonPage(order: readonly MoonPage[], from: MoonPage, to: MoonPage): MoonPage[] {
  const pages = parseMoonOrder(order);
  const source = pages.indexOf(from), target = pages.indexOf(to);
  if (source < 0 || target < 0 || source === target) return pages;
  pages.splice(source, 1);
  pages.splice(target, 0, from);
  return pages;
}

export function shiftMoonPage(order: readonly MoonPage[], id: MoonPage, delta: -1 | 1): MoonPage[] {
  const pages = parseMoonOrder(order);
  const index = pages.indexOf(id);
  if (index < 0 || index + delta < 0 || index + delta >= pages.length) return pages;
  return moveMoonPage(pages, id, pages[index + delta]);
}

export const MOON_LAYOUT_KEY = 'prmoon';

export const DEFAULT_MOON_LAYOUT = {
  pagePadding: 11,
  sectionGap: 15,
  baseFont: 12,
  titleFont: 26,
  attributeHeight: 79,
  noteHeight: 246,
  lineColor: '#bfc4c8',
  inkColor: '#1c1e21',
  portraitWidth: 210,
  portraitShiftX: 0,
  portraitShiftY: 0,
};
export type MoonLayout = typeof DEFAULT_MOON_LAYOUT;
export type MoonLayoutKey = keyof MoonLayout;
export const MOON_LAYOUT_CONTROLS: { key: MoonLayoutKey; title: string; min?: number; max?: number; step?: number; unit?: string }[] = [
  { key: 'pagePadding', title: 'Поля страницы', min: 7, max: 22, step: 1, unit: 'мм' },
  { key: 'sectionGap', title: 'Отступ между разделами', min: 6, max: 45, step: 1, unit: 'px' },
  { key: 'baseFont', title: 'Основной шрифт', min: 10, max: 18, step: 1, unit: 'px' },
  { key: 'titleFont', title: 'Заголовок страницы', min: 20, max: 42, step: 1, unit: 'px' },
  { key: 'attributeHeight', title: 'Высота карточек характеристик', min: 65, max: 160, step: 1, unit: 'px' },
  { key: 'noteHeight', title: 'Минимальная высота заметок', min: 160, max: 520, step: 2, unit: 'px' },
  { key: 'lineColor', title: 'Цвет линий' },
  { key: 'inkColor', title: 'Цвет текста' },
  { key: 'portraitWidth', title: 'Ширина рамки и маски', min: 155, max: 270, step: 1, unit: 'px' },
  { key: 'portraitShiftX', title: 'Смещение рамки по горизонтали', min: -35, max: 35, step: 1, unit: 'px' },
  { key: 'portraitShiftY', title: 'Смещение рамки по вертикали', min: -35, max: 35, step: 1, unit: 'px' },
];

type Entry = { id: string; value: unknown };
const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  !!raw && typeof raw === 'object' && !Array.isArray(raw);

export function parseMoonLayout(raw: unknown): MoonLayout {
  const safe = { ...DEFAULT_MOON_LAYOUT };
  if (!Array.isArray(raw)) return safe;
  const entries = new Map<string, unknown>();
  for (const item of raw) {
    if (isRecord(item) && typeof item.id === 'string') entries.set(item.id, item.value);
  }
  for (const control of MOON_LAYOUT_CONTROLS) {
    const input = entries.get(control.key);
    if (typeof DEFAULT_MOON_LAYOUT[control.key] === 'number') {
      if (typeof input !== 'number' || !Number.isFinite(input)) continue;
      const value = Math.max(control.min ?? input, Math.min(control.max ?? input, input));
      // All numeric settings are integers; validated client-side and on read.
      (safe as Record<string, string | number>)[control.key] = Math.round(value);
    } else if (typeof input === 'string' && /^#[0-9a-fA-F]{6}$/.test(input)) {
      (safe as Record<string, string | number>)[control.key] = input.toLowerCase();
    }
  }
  return safe;
}

export function encodeMoonLayout(layout: MoonLayout): Entry[] {
  const values = MOON_LAYOUT_CONTROLS.map(({key}) => ({ id: key, value: layout[key] }));
  return values;
}

export function moonLayoutVariables(layout: MoonLayout): Record<string, string> {
  return {
    '--moon-page-padding': layout.pagePadding + 'mm',
    '--moon-section-gap': layout.sectionGap + 'px',
    '--moon-text-size': layout.baseFont + 'px',
    '--moon-title-size': layout.titleFont + 'px',
    '--moon-attr-height': layout.attributeHeight + 'px',
    '--moon-note-height': layout.noteHeight + 'px',
    '--moon-portrait-width': layout.portraitWidth + 'px',
    '--moon-portrait-shift-x': layout.portraitShiftX + 'px',
    '--moon-portrait-shift-y': layout.portraitShiftY + 'px',
    '--moon-line': layout.lineColor,
    '--moon-ink': layout.inkColor,
  };
}

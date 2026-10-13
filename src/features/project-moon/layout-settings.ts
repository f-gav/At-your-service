export const MOON_LAYOUT_KEY = 'prmoon';

export const MOON_TEXT_GROUPS = [
  { key: 'pageKicker', title: 'Надпись PROJECT MOON' },
  { key: 'pageTitle', title: 'Заголовки страниц' },
  { key: 'sectionTitle', title: 'Заголовки разделов' },
  { key: 'fieldLabel', title: 'Подписи полей' },
  { key: 'fieldValue', title: 'Значения в полях' },
  { key: 'characterName', title: 'Имя персонажа' },
  { key: 'attributeLabel', title: 'Названия характеристик' },
  { key: 'resourceTitle', title: 'Названия ресурсов' },
  { key: 'cardTitle', title: 'Названия оружия и карточек' },
  { key: 'noteTitle', title: 'Заголовки заметок' },
  { key: 'bodyText', title: 'Текст описаний и заметок' },
] as const;
export type MoonTextGroup = typeof MOON_TEXT_GROUPS[number]['key'];
export type MoonFontFamily = 'sans' | 'serif' | 'mono';
export type MoonTextAlign = 'left' | 'center' | 'right';
export type MoonTextStyle = {
  size: number;
  weight: number;
  italic: boolean;
  letterSpacing: number;
  lineHeight: number;
  family: MoonFontFamily;
  align: MoonTextAlign;
};
type MoonTextStyles = Record<MoonTextGroup, MoonTextStyle>;

const basicTextStyle = (size: number, weight: number): MoonTextStyle => ({
  size, weight, italic: false, letterSpacing: 0, lineHeight: 1.35,
  family: 'sans', align: 'left',
});

export const DEFAULT_MOON_TEXT_STYLES: MoonTextStyles = {
  pageKicker: basicTextStyle(15, 800),
  pageTitle: basicTextStyle(26, 800),
  sectionTitle: basicTextStyle(13, 800),
  fieldLabel: basicTextStyle(9, 800),
  fieldValue: basicTextStyle(12, 500),
  characterName: basicTextStyle(15, 600),
  attributeLabel: basicTextStyle(11, 800),
  resourceTitle: basicTextStyle(9, 800),
  cardTitle: basicTextStyle(12, 800),
  noteTitle: basicTextStyle(11, 800),
  bodyText: basicTextStyle(11, 400),
};

export const cloneMoonTextStyles = (): MoonTextStyles =>
  Object.fromEntries(MOON_TEXT_GROUPS.map(({key}) =>
    [key, { ...DEFAULT_MOON_TEXT_STYLES[key] }])) as MoonTextStyles;

export const DEFAULT_MOON_LAYOUT = {
  pagePadding: 11,
  sectionGap: 15,
  baseFont: 12,
  titleFont: 26,
  attributeHeight: 79,
  noteHeight: 246,
  lineColor: '#bfc4c8',
  inkColor: '#1c1e21',
  portraitWidth: 170,
  portraitShiftX: 7,
  portraitShiftY: -90,
  // Mask artwork and its portrait window move independently of the frame.
  maskWidth: 98,
  maskHeight: 98,
  maskShiftX: -2,
  maskShiftY: 2,
  textStyles: cloneMoonTextStyles(),
  elementStyles: {} as Record<string, Partial<MoonTextStyle>>,
};
export type MoonLayout = typeof DEFAULT_MOON_LAYOUT;
export type MoonLayoutKey = keyof MoonLayout;
export type MoonNumericColorKey = Exclude<MoonLayoutKey, 'textStyles' | 'elementStyles'>;
export const isMoonPortraitShift = (key: MoonLayoutKey): boolean =>
  key === 'portraitShiftX' || key === 'portraitShiftY' ||
  key === 'maskShiftX' || key === 'maskShiftY';

type MoonLayoutControl = {
  key: MoonNumericColorKey;
  title: string; min?: number; max?: number; step?: number; unit?: string;
};

export const MOON_LAYOUT_CONTROLS: MoonLayoutControl[] = [
  { key: 'pagePadding', title: 'Поля страницы', min: 7, max: 22, step: 1, unit: 'мм' },
  { key: 'sectionGap', title: 'Отступ между разделами', min: 6, max: 45, step: 1, unit: 'px' },
  { key: 'baseFont', title: 'Основной шрифт', min: 10, max: 18, step: 1, unit: 'px' },
  { key: 'titleFont', title: 'Заголовок страницы', min: 20, max: 42, step: 1, unit: 'px' },
  { key: 'attributeHeight', title: 'Высота карточек характеристик', min: 65, max: 160, step: 1, unit: 'px' },
  { key: 'noteHeight', title: 'Минимальная высота заметок', min: 160, max: 520, step: 2, unit: 'px' },
  { key: 'lineColor', title: 'Цвет линий' },
  { key: 'inkColor', title: 'Цвет текста' },
  { key: 'portraitWidth', title: 'Ширина рамки', min: 155, max: 270, step: 1, unit: 'px' },
  { key: 'portraitShiftX', title: 'Смещение рамки по горизонтали', min: -35, max: 35, step: 1, unit: 'px' },
  { key: 'portraitShiftY', title: 'Смещение рамки по вертикали', min: -35, max: 35, step: 1, unit: 'px' },
  { key: 'maskWidth', title: 'Ширина маски', min: 30, max: 220, step: 1, unit: '%' },
  { key: 'maskHeight', title: 'Высота маски', min: 30, max: 220, step: 1, unit: '%' },
  { key: 'maskShiftX', title: 'Смещение маски по горизонтали', min: -35, max: 35, step: 1, unit: 'px' },
  { key: 'maskShiftY', title: 'Смещение маски по вертикали', min: -35, max: 35, step: 1, unit: 'px' },
];

type Entry = { id: string; value: unknown };
const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  !!raw && typeof raw === 'object' && !Array.isArray(raw);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const allowedFonts: MoonFontFamily[] = ['sans','serif','mono'];
const allowedAligns: MoonTextAlign[] = ['left','center','right'];
export function normalizeMoonTextStyle(input: unknown, original: MoonTextStyle): MoonTextStyle {
  const next = { ...original };
  if (!isRecord(input)) return next;
  if (typeof input.size === 'number' && Number.isFinite(input.size))
    next.size = Math.round(clamp(input.size, 5, 160));
  if (typeof input.weight === 'number' && Number.isFinite(input.weight))
    next.weight = Math.round(clamp(input.weight, 100, 900) / 100) * 100;
  if (typeof input.italic === 'boolean') next.italic = input.italic;
  if (typeof input.letterSpacing === 'number' && Number.isFinite(input.letterSpacing))
    next.letterSpacing = Math.round(clamp(input.letterSpacing,-30,50) * 10) / 10;
  if (typeof input.lineHeight === 'number' && Number.isFinite(input.lineHeight))
    next.lineHeight = Math.round(clamp(input.lineHeight,0.5,6) * 20) / 20;
  if (allowedFonts.includes(input.family as MoonFontFamily))
    next.family = input.family as MoonFontFamily;
  if (allowedAligns.includes(input.align as MoonTextAlign))
    next.align = input.align as MoonTextAlign;
  return next;
}

export function parseMoonLayout(raw: unknown): MoonLayout {
  const safe: MoonLayout = { ...DEFAULT_MOON_LAYOUT, textStyles: cloneMoonTextStyles(), elementStyles: {} };
  if (!Array.isArray(raw)) return safe;
  const entries = new Map<string, unknown>();
  for (const item of raw) {
    if (isRecord(item) && typeof item.id === 'string') entries.set(item.id, item.value);
  }
  for (const control of MOON_LAYOUT_CONTROLS) {
    const input = entries.get(control.key);
    if (typeof DEFAULT_MOON_LAYOUT[control.key] === 'number') {
      if (typeof input !== 'number' || !Number.isFinite(input)) continue;
      const value = input;
      (safe as Record<string, unknown>)[control.key] = Math.round(value);
    } else if (typeof input === 'string' && /^#[0-9a-fA-F]{6}$/.test(input)) {
      (safe as Record<string, unknown>)[control.key] = input.toLowerCase();
    }
  }
  const styles = entries.get('textStyles');
  if (isRecord(styles)) {
    for (const {key} of MOON_TEXT_GROUPS)
      safe.textStyles[key] = normalizeMoonTextStyle(styles[key], safe.textStyles[key]);
  }
  const individual = entries.get('elementStyles');
  if(isRecord(individual))for(const [key,value] of Object.entries(individual)){
    if(!/^moon-page-(dossier|combat|about|notes)\\|[a-zA-Z0-9_:|.-]{1,120}$/.test(key))continue;
    if(!isRecord(value))continue;
    safe.elementStyles[key] = normalizeMoonTextStyle(value,DEFAULT_MOON_TEXT_STYLES.fieldLabel);
  }
  // Existing title-size setting remains canonical for backward compatibility.
  safe.textStyles.pageTitle.size = safe.titleFont;
  return safe;
}

export function encodeMoonLayout(layout: MoonLayout): Entry[] {
  return [
    ...MOON_LAYOUT_CONTROLS.map(({key}) => ({ id: key, value: layout[key] })),
    { id:'elementStyles',value:layout.elementStyles },
    { id:'textStyles', value:{
      ...layout.textStyles,
      pageTitle:{...layout.textStyles.pageTitle,size:layout.titleFont},
    } },
  ];
}

const fontStack: Record<MoonFontFamily,string> = {
  sans: "'DejaVu Sans','Noto Sans',Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  mono: "'DejaVu Sans Mono',Consolas,monospace",
};

export function moonLayoutVariables(layout: MoonLayout): Record<string,string> {
  const variables: Record<string,string> = {
    '--moon-page-padding': layout.pagePadding + 'mm',
    '--moon-section-gap': layout.sectionGap + 'px',
    '--moon-text-size': layout.baseFont + 'px',
    '--moon-title-size': layout.titleFont + 'px',
    '--moon-attr-height': layout.attributeHeight + 'px',
    '--moon-note-height': layout.noteHeight + 'px',
    '--moon-portrait-width': layout.portraitWidth + 'px',
    '--moon-portrait-shift-x': layout.portraitShiftX + 'px',
    '--moon-portrait-shift-y': layout.portraitShiftY + 'px',
    '--moon-mask-width': layout.maskWidth + '%',
    '--moon-mask-height': layout.maskHeight + '%',
    '--moon-mask-shift-x': layout.maskShiftX + 'px',
    '--moon-mask-shift-y': layout.maskShiftY + 'px',
    '--moon-line': layout.lineColor,
    '--moon-ink': layout.inkColor,
  };
  for (const {key} of MOON_TEXT_GROUPS) {
    const style = layout.textStyles[key];
    const prefix = '--moon-type-' + key + '-';
    variables[prefix + 'size'] = (key === 'pageTitle' ? layout.titleFont : style.size) + 'px';
    variables[prefix + 'weight'] = String(style.weight);
    variables[prefix + 'style'] = style.italic ? 'italic' : 'normal';
    variables[prefix + 'spacing'] = style.letterSpacing + 'px';
    variables[prefix + 'leading'] = String(style.lineHeight);
    variables[prefix + 'family'] = fontStack[style.family];
    variables[prefix + 'align'] = style.align;
  }
  return variables;
}

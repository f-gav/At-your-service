/** List choices are part of the published *layout schema*, not character JSON values. */
export const PF2E_SIZE_OPTIONS = [
  'Крошечный', 'Маленький', 'Средний', 'Большой', 'Огромный', 'Исполинский',
] as const;

export const DEFAULT_SELECT_OPTIONS = ['Вариант 1', 'Вариант 2'] as const;

export function parseOptions(text: string): string[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}
export function validOptions(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 60
    && new Set(value).size === value.length
    && value.every(option => typeof option === 'string'
      && option.length >= 1 && option.length <= 100 && option.trim() === option);
}
export function isHeroPointId(id: string): boolean {
  return /^hero_[123]$/.test(id);
}

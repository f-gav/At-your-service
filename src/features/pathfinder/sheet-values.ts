import type { CharacterDetails } from '../../lib/models';

/**
 * PF2e values are keyed by permanent field IDs, not by a fixed set of PDF fields.
 * The admin can add, hide and restore fields without changing character data.
 */
export type FieldValue = string | boolean;
export type SheetValues = Record<string, FieldValue>;

const SHEET_KEY = 'pathfinderSheet';
const SCHEMA_VERSION = 1;

function storedSheet(details: CharacterDetails): Record<string, unknown> {
  const value = details[SHEET_KEY];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Load *all* saved field values, including IDs added through the template editor. */
export function initialSheetValues(details: CharacterDetails, characterName: string): SheetValues {
  const values: SheetValues = {};
  for (const [id, value] of Object.entries(storedSheet(details))) {
    if (id === 'schemaVersion' || id === 'name') continue;
    if (typeof value === 'string' || typeof value === 'boolean') {
      values[id] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      values[id] = String(value);
    }
  }
  values.name = characterName;
  return values;
}

/**
 * Save the edited values while preserving IDs absent from the current template,
 * as well as any future sheet metadata. Explicitly cleared fields are removed.
 * Export/import JSON already transports details.pathfinderSheet without filtering IDs.
 */
export function persistSheetValues(
  details: CharacterDetails,
  values: SheetValues,
  cleanName: string,
): CharacterDetails {
  const saved: Record<string, unknown> = { ...storedSheet(details) };
  for (const [id, value] of Object.entries(values)) {
    if (value === '' || value === false) delete saved[id];
    else saved[id] = value;
  }
  saved.name = cleanName;
  saved.schemaVersion = SCHEMA_VERSION;
  return { ...details, [SHEET_KEY]: saved };
}

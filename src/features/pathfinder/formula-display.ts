/**
 * Formula component cells already have printed + signs and a mathematical
 * place in the original PDF artwork. Avoid repeating signs in the cells.
 * This is presentation only; raw negative/positive values remain untouched
 * in the model, calculations and serialized character data.
 */
export function isFormulaOperandField(id: string): boolean {
  return /^(?:armor_(?:dex|prof|item)|perception_(?:ability|prof|item)|save_(?:fort|reflex|will)_(?:ability|prof|item)|skill_[a-z0-9]+_(?:ability|prof|item|armor)|weapon_[1-5]_(?:ability|prof|item)|(?:spell_(?:attack|dc)|class_dc)_(?:key|item))$/.test(id);
}

export function formulaDisplayValue(id: string, raw: string, isEditing = false): string {
  if (isEditing || !isFormulaOperandField(id)) return raw;
  return raw.replace(/^[+-](?=\d)/, '');
}

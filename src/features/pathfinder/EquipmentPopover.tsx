import { X } from 'lucide-react';
import type { FieldValue, SheetValues } from './sheet-values';
import { ARMOR_CATEGORIES } from './rules-combat';
import './EquipmentPopover.css';

type EquipmentKind = 'armor' | 'shield';
type Props = {
  kind: EquipmentKind;
  values: SheetValues;
  automatic: boolean;
  disabled: boolean;
  onChange: (id: string, value: FieldValue) => void;
  onClose: () => void;
};

const read = (values: SheetValues, id: string) => String(values[id] ?? '');
const checked = (values: SheetValues, id: string) =>
  values[id] === true || values[id] === 'true';

export default function EquipmentPopover({ kind, values, automatic, disabled, onChange, onClose }: Props) {
  const isArmor = kind === 'armor';
  const titleId = 'pf-equipment-title';
  const input = (id: string, label: string, hint?: string) => (
    <label key={id} className="pf-equipment-field">
      <span>{label}</span>
      <input type="text" inputMode="decimal" autoComplete="off"
        value={read(values, id)}
        onChange={event => onChange(id, event.target.value)}
        disabled={disabled} />
      {hint && <small>{hint}</small>}
    </label>
  );
  return <div className={`pf-equipment-popover pf-equipment-${kind}`}
      data-pf-equipment role="dialog" aria-modal="false" aria-labelledby={titleId}>
    <div className="pf-equipment-header">
      <h2 id={titleId}>{isArmor ? 'Надетая броня' : 'Щит'}</h2>
      <button type="button" className="pf-equipment-close" onClick={onClose}
        aria-label="Закрыть настройки" title="Закрыть" disabled={disabled}><X size={18}/></button>
    </div>
    {isArmor ? <>
      <label className="pf-equipment-field">
        <span>Название доспеха</span>
        <input autoFocus type="text" maxLength={120} placeholder="Например: кожаный доспех"
          value={read(values, 'combat_armor_name')}
          onChange={event => onChange('combat_armor_name', event.target.value)} disabled={disabled}/>
      </label>
      <label className="pf-equipment-field">
        <span>Категория доспеха</span>
        <select value={read(values,'combat_armor_category')} disabled={disabled}
          onChange={event => {
            onChange('combat_armor_category', event.target.value);
            if (event.target.value) onChange('combat_armor_enabled', 'true');
          }}>
          <option value="">— Выбери категорию —</option>
          {ARMOR_CATEGORIES.map((name, index) =>
            <option key={name} value={String(index)}>{name}</option>)}
        </select>
      </label>
      <label className="pf-equipment-check">
        <input type="checkbox" checked={checked(values,'combat_armor_enabled')}
          onChange={event => onChange('combat_armor_enabled',event.target.checked ? 'true':'false')}
          disabled={disabled}/>
        Использовать эту броню для расчёта КД
      </label>
      <div className="pf-equipment-grid">
        {!automatic && input('armor_class','КД вручную','В ручном режиме КД вводится здесь или на листе.')}
        {input('combat_armor_dex_cap','Макс. бонус Ловкости','Предел бонуса от брони; для категории «Без брони» можно не указывать.')}
        {input('combat_armor_item_bonus','Бонус КД от брони','Включая соответствующие бонусы предмета.')}
        {input('combat_armor_check_penalty','Штраф проверок','Неотрицательное число, например 2.')}
        {input('combat_armor_strength_requirement','Требование Силы','При достаточной Силе штраф проверок снимается.')}
        {input('combat_armor_other_ac','Поправка КД','Дополнительная поправка, если применима.')}
      </div>
      <label className="pf-equipment-check">
        <input type="checkbox" checked={checked(values,'combat_armor_skill_penalty_enabled')}
          onChange={event => onChange('combat_armor_skill_penalty_enabled',event.target.checked ? 'true':'false')}
          disabled={disabled}/>
        Учитывать штраф брони в навыках
      </label>
      <p className="pf-equipment-help">
        {automatic
          ? 'КД, применяемая Ловкость, владение и штрафы навыков рассчитываются в ячейках листа. Ранг владения выбирается на самом листе.'
          : 'Сейчас включён ручной режим. Сохраним параметры, но автоматические формулы начнут действовать после включения расчётов в настройках листа.'}
        {' '}Проверяй типы бонусов: одинаковые бонусы обычно не суммируются.
      </p>
    </> : <>
      <label className="pf-equipment-field">
        <span>Название, описание и заметки о щите</span>
        <textarea autoFocus rows={7} maxLength={3000}
          placeholder="Например: Стальной щит. Особые свойства, руны, примечания…"
          value={read(values,'combat_shield_notes')}
          onChange={event => onChange('combat_shield_notes',event.target.value)}
          disabled={disabled}/>
      </label>
      <p className="pf-equipment-help">Это свободный текст. Твёрдость, ПЗ и порог поломки щита по-прежнему находятся в отдельных ячейках самого листа.</p>
    </>}
  </div>;
}

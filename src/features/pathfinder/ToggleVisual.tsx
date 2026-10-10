import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { PathfinderField } from './layout';
import { toggleAppearance } from './toggle-shapes';
import { isHeroPointId } from './field-options';

/** A boolean visual shared by the actual sheet and the admin preview. */
export default function ToggleVisual({
  field, checked, editorGuide = false,
}: {
  field: PathfinderField;
  checked: boolean;
  editorGuide?: boolean;
}) {
  const appearance = toggleAppearance(field);
  const style = {
    '--toggle-inset-x': appearance.insetX + '%',
    '--toggle-inset-y': appearance.insetY + '%',
  } as CSSProperties;
  return <span
    className="pf-toggle-visual"
    data-shape={appearance.shape}
    data-mode={appearance.mode}
    data-checked={checked ? 'true' : 'false'}
    data-editor-guide={editorGuide ? 'true' : 'false'}
    data-native-dark-hero={isHeroPointId(field.id) ? 'true' : 'false'}
    style={style}
    aria-hidden="true"
  >
    <span className="pf-toggle-fill-shape" />
    {appearance.mode === 'check' && checked && <Check />}
  </span>;
}

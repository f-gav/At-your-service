import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// Use the exact same confirmation styles as the PF2e level deletion dialog.
import '../pathfinder/DynamicAdvancement.css';

type Props = {
  label: string;
  kind?: 'weapon' | 'skill';
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
};

export default function MoonWeaponDeleteDialog({ label, kind = 'weapon', onCancel, onConfirm, disabled = false }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelCallback = useRef(onCancel);
  cancelCallback.current = onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCallback.current();
      } else if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault();
          deleteRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === deleteRef.current) {
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div className="pf-advancement-confirm-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="pf-advancement-confirm" role="dialog" aria-modal="true"
        aria-labelledby="moon-weapon-confirm-title" aria-describedby="moon-weapon-confirm-description">
        <h2 id="moon-weapon-confirm-title">Удалить {label}?</h2>
        <p id="moon-weapon-confirm-description">
          {kind === 'skill' ? 'Вы точно хотите удалить приём?' : 'Вы точно хотите удалить оружие?'} Все данные этой карточки будут потеряны.
          {kind === 'skill' ? 'Остальные приёмы сохранят свои данные и порядок.' : 'Остальные карточки оружия переместятся на её место.'}
        </p>
        <div className="pf-advancement-confirm-actions">
          <button type="button" ref={cancelRef} onClick={onCancel}>Отмена</button>
          <button type="button" ref={deleteRef} className="pf-advancement-confirm-delete"
            disabled={disabled} onClick={onConfirm}>Удалить</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

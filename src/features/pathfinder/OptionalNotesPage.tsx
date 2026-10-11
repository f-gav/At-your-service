import {useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import {Minus, Pencil, Plus} from 'lucide-react';
import RichField from './RichField';
import type {SheetValues} from './sheet-values';
import {
  PF_NOTES_BLOCK_COUNT, PF_NOTES_HEIGHT_MAX, PF_NOTES_HEIGHT_MIN,
  noteBodyKey, noteTitleKey, noteHeightKey,
  noteBlockHeight, noteBlockTitle, resizeNoteBlock,
} from './notes-blocks';
import './OptionalNotesPage.css';

type Props = {
  values: SheetValues;
  disabled?: boolean;
  onChange: (id: string, value: string) => void;
};

/** The optional sheet is editable HTML and can grow beyond a paper page.
 * Each block has its own stable field IDs. The first one keeps the pre-existing
 * pf2e_notes_content key; changing the layout never discards old notes.
 */
export default function OptionalNotesPage({values, disabled = false, onChange}: Props) {
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const cancelTitle = useRef(false);

  function startEditingTitle(index: number) {
    if (disabled) return;
    cancelTitle.current = false;
    setDraftTitle(noteBlockTitle(values[noteTitleKey(index)]));
    setEditingTitle(index);
  }

  function finishEditingTitle(index: number) {
    if (!cancelTitle.current) {
      onChange(noteTitleKey(index), draftTitle.trim());
    }
    cancelTitle.current = false;
    setEditingTitle(null);
  }

  return (
    <section
      id="pf-sheet-page-notes"
      className="pf-sheet-page pf-optional-notes-page"
      aria-label="Дополнительная страница: Заметки"
    >
      <header className="pf-optional-notes-heading">
        <span className="pf-optional-notes-heading-rule" aria-hidden="true"/>
        <h2>Заметки</h2>
        <span className="pf-optional-notes-heading-rule" aria-hidden="true"/>
      </header>
      <div className="pf-optional-notes-grid">
        {Array.from({length: PF_NOTES_BLOCK_COUNT}, (_, index) => {
          const titleId = noteTitleKey(index);
          const heightId = noteHeightKey(index);
          const height = noteBlockHeight(values[heightId]);
          const title = noteBlockTitle(values[titleId]);
          return (
            <article
              key={noteBodyKey(index)}
              className="pf-optional-note-card"
              aria-label={`Блок заметок ${index + 1}: ${title}`}
              style={{'--pf-note-card-min-height': `${height}cqw`} as CSSProperties}
            >
              <div className="pf-optional-note-card-heading">
                {editingTitle === index
                  ? <input
                      className="pf-optional-note-card-title-input"
                      type="text" autoFocus maxLength={60}
                      aria-label={`Название блока заметок ${index + 1}`}
                      disabled={disabled} value={draftTitle}
                      onChange={event => setDraftTitle(event.target.value)}
                      onBlur={() => finishEditingTitle(index)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') {
                          cancelTitle.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  : <span className="pf-optional-note-card-title">{title}</span>}
                <button
                  className="pf-optional-note-card-rename"
                  type="button" disabled={disabled || editingTitle === index}
                  title="Переименовать блок" aria-label={`Переименовать блок ${index + 1}`}
                  onClick={() => startEditingTitle(index)}
                >
                  <Pencil aria-hidden="true" size={14}/>
                </button>
              </div>
              <RichField
                id={`pf-optional-notes-block-${index + 1}`}
                label={`Содержимое блока заметок ${index + 1}: ${title}`}
                className="pf-optional-note-card-body" grow
                placeholder="Запиши заметку…"
                value={String(values[noteBodyKey(index)] ?? '')}
                resourceContext={values}
                disabled={disabled}
                onChange={next => onChange(noteBodyKey(index), next)}
              />
              <div className="pf-optional-note-card-controls" role="group"
                aria-label={`Высота блока заметок ${index + 1}`}>
                <button type="button" disabled={disabled || height >= PF_NOTES_HEIGHT_MAX}
                  onClick={() => onChange(heightId, resizeNoteBlock(values[heightId], 1))}
                  title="Увеличить блок" aria-label={`Увеличить блок ${index + 1}`}>
                  <Plus aria-hidden="true" size={14}/>
                </button>
                <button type="button" disabled={disabled || height <= PF_NOTES_HEIGHT_MIN}
                  onClick={() => onChange(heightId, resizeNoteBlock(values[heightId], -1))}
                  title="Уменьшить блок" aria-label={`Уменьшить блок ${index + 1}`}>
                  <Minus aria-hidden="true" size={14}/>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

import RichField from './RichField';
import type {SheetValues} from './sheet-values';
import {PF_NOTES_BLOCK_COUNT, noteBodyKey, noteBlockTitle, noteTitleKey} from './notes-blocks';
import './OptionalNotesPage.css';

type Props = {
  values: SheetValues;
  disabled?: boolean;
  onChange: (id: string, value: string) => void;
};

/**
 * The fifth sheet uses the supplied artwork, just like the four original PDF
 * pages. Six transparent editors sit inside the printed rectangles; the image
 * itself already contains the heading, borders and six "Заметки" captions.
 *
 * Keep the existing stable note IDs (especially pf2e_notes_content) so a new
 * background never removes previously saved notes or changes JSON exports.
 */
export default function OptionalNotesPage({values, disabled = false, onChange}: Props) {
  return (
    <section
      id="pf-sheet-page-notes"
      className="pf-sheet-page pf-optional-notes-page"
      aria-label="Дополнительная страница: Заметки"
    >
      <img
        src={`${import.meta.env.BASE_URL}pathfinder/notes-page.svg`}
        width="1573" height="2048"
        loading="lazy" decoding="async"
        draggable={false}
        alt="Бланк Заметки для кампании с шестью текстовыми областями"
      />
      <div className="pf-optional-notes-grid">
        {Array.from({length: PF_NOTES_BLOCK_COUNT}, (_, index) => {
          const title = noteBlockTitle(values[noteTitleKey(index)]);
          return (
            <div key={noteBodyKey(index)} className="pf-optional-note-card"
              aria-label={`Блок заметок ${index + 1}: ${title}`}>
              <RichField
                id={`pf-optional-notes-block-${index + 1}`}
                label={`Содержимое блока заметок ${index + 1}: ${title}`}
                className="pf-optional-note-card-body"
                value={String(values[noteBodyKey(index)] ?? '')}
                resourceContext={values}
                textSize={Number(values['pf_text_size_'+noteBodyKey(index)])>=8&&Number(values['pf_text_size_'+noteBodyKey(index)])<=28?Number(values['pf_text_size_'+noteBodyKey(index)]):undefined}
                onTextSizeChange={size=>onChange('pf_text_size_'+noteBodyKey(index),String(size))}
                disabled={disabled}
                onChange={next => onChange(noteBodyKey(index), next)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

import RichField from './RichField';
import type {SheetValues} from './sheet-values';
import {PF_NOTES_CONTENT_KEY} from './page-order';
import './OptionalNotesPage.css';

type Props={
  values:SheetValues;
  disabled?:boolean;
  onChange:(value:string)=>void;
};
/** The optional fifth sheet is pure HTML rather than an image overlay.
 * Editing grows downward without any internal scrollbar or hard page crop.
 * It is still part of the same character JSON and follows the same rich
 * editor behavior as abilities: lists, spoilers, resources and dividers.
 */
export default function OptionalNotesPage({values,disabled=false,onChange}:Props){
  return <section id="pf-sheet-page-notes" className="pf-sheet-page pf-optional-notes-page"
    aria-label="Дополнительная страница: Заметки">
    <div className="pf-optional-notes-heading">
      <h2>Заметки</h2>
      <span aria-hidden="true" className="pf-optional-notes-heading-line"/>
    </div>
    <RichField id="pf-optional-notes-editor" label="Дополнительные заметки персонажа"
      className="pf-optional-notes-rich" grow
      placeholder="Запиши историю, способности, детали приключений или другие заметки…"
      value={String(values[PF_NOTES_CONTENT_KEY]??'')}
      resourceContext={values} disabled={disabled} onChange={onChange}/>
  </section>;
}

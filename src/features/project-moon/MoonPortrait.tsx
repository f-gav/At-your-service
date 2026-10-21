import PortraitImage from '../portrait/PortraitImage';
import type { CropFrame } from '../portrait/crop';
import './MoonPortrait.css';

export const MOON_PORTRAIT_FRAME = `${import.meta.env.BASE_URL}project-moon/portrait-frame.png?v=2`;
export const MOON_PORTRAIT_MASK = `${import.meta.env.BASE_URL}project-moon/character-icon.png`;

type Props = {
  url?: string;
  frame?: CropFrame | null;
  name?: string;
  onEditPortrait?: () => void;
};

/**
 * The frame stays on its own 384 x 586 canvas. The mask and live portrait
 * occupy a separate adjustable layer; the clickable area follows that layer
 * without affecting any other character-sheet system.
 */
export default function MoonPortrait({url, frame, name = '', onEditPortrait}: Props) {
  return <div className="moon-portrait-art">
    <img className="moon-portrait-art-frame" src={MOON_PORTRAIT_FRAME} alt="" draggable={false} fetchPriority="high" />
    <span className="moon-portrait-art-mask-layer">
      {url
        ? <span className="moon-portrait-art-window">
            <PortraitImage url={url} frame={frame} alt="" />
          </span>
        : <span className="moon-portrait-art-window"><img className="moon-portrait-art-mask" src={MOON_PORTRAIT_MASK} alt="" draggable={false} /></span>}
      {onEditPortrait && <button type="button" className="moon-portrait-art-trigger"
        aria-label={url ? 'Изменить портрет персонажа' : 'Добавить портрет персонажа'}
        title={url ? 'Изменить портрет' : 'Добавить портрет'}
        onClick={onEditPortrait} />}
    </span>
    <span className="moon-portrait-art-caption" title={name}>{name}</span>
  </div>;
}

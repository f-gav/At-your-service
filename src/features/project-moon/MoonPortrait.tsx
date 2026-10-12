import PortraitImage from '../portrait/PortraitImage';
import type { CropFrame } from '../portrait/crop';
import './MoonPortrait.css';

export const MOON_PORTRAIT_FRAME = `${import.meta.env.BASE_URL}project-moon/portrait-frame.png?v=2`;
export const MOON_PORTRAIT_MASK = `${import.meta.env.BASE_URL}project-moon/portrait-placeholder.png`;

type Props = {
  url?: string;
  frame?: CropFrame | null;
  name?: string;
  onEditPortrait?: () => void;
};

/**
 * The frame and the goblin placeholder share exactly the same 384 x 586 canvas.
 * The hit area is the mask's rectangular portrait window; clicking there
 * opens the existing crop editor without changing other systems' portraits.
 */
export default function MoonPortrait({url, frame, name = '', onEditPortrait}: Props) {
  return <div className="moon-portrait-art">
    <img className="moon-portrait-art-frame" src={MOON_PORTRAIT_FRAME} alt="" draggable={false} />
    {url
      ? <span className="moon-portrait-art-window">
          <PortraitImage url={url} frame={frame} alt="" />
        </span>
      : <img className="moon-portrait-art-mask" src={MOON_PORTRAIT_MASK} alt="" draggable={false} />}
    <span className="moon-portrait-art-caption" title={name}>{name}</span>
    {onEditPortrait && <button type="button" className="moon-portrait-art-trigger"
      aria-label={url ? 'Изменить портрет персонажа' : 'Добавить портрет персонажа'}
      title={url ? 'Изменить портрет' : 'Добавить портрет'}
      onClick={onEditPortrait} />}
  </div>;
}

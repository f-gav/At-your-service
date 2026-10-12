import PortraitImage from '../portrait/PortraitImage';
import type { CropFrame } from '../portrait/crop';
import './MoonPortrait.css';

const FRAME = `${import.meta.env.BASE_URL}project-moon/portrait-frame.png`;
const PLACEHOLDER = `${import.meta.env.BASE_URL}project-moon/portrait-placeholder.png`;

type Props = {
  url?: string;
  frame?: CropFrame | null;
  name?: string;
  compact?: boolean;
};

/**
 * Portrait uses the user-provided Project Moon frame and placeholder mask.
 * Full dossier shows the character's name in the bottom plate; the home
 * thumbnail crops that plate away, leaving existing card metadata untouched.
 */
export default function MoonPortrait({url, frame, name = '', compact = false}: Props) {
  return <span className={'moon-portrait-art' + (compact ? ' moon-portrait-art--compact' : '')}>
    <span className="moon-portrait-art-stage">
      {url
        ? <span className="moon-portrait-art-window">
            <PortraitImage url={url} frame={frame} alt="" />
          </span>
        : <img className="moon-portrait-art-placeholder" src={PLACEHOLDER} alt="" draggable={false} />}
      <img className="moon-portrait-art-frame" src={FRAME} alt="" draggable={false} />
      {!compact && <span className="moon-portrait-art-caption" title={name}>{name}</span>}
    </span>
  </span>;
}

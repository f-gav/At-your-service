import type { CSSProperties } from 'react';
import { frameStyle,validFrame } from './crop';
import type { CropFrame } from './crop';

/** Displays one optimized WebP with non-destructive per-view crop metadata. */
export default function PortraitImage({url,frame,alt='',className}:{url:string;frame?:CropFrame|null;alt?:string;className?:string}) {
  const style:CSSProperties=frame&&validFrame(frame)?frameStyle(frame):{};
  return <img src={url} alt={alt} className={className} style={style} draggable={false}/>;
}

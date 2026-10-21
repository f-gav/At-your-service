import {useEffect,useState} from 'react';
import type {CSSProperties} from 'react';
import {frameStyle,validFrame} from './crop';
import type {CropFrame} from './crop';

const decoded=new Set<string>();
/** Show a stable neutral placeholder until the remote image is decoded. */
export default function PortraitImage({url,frame,alt='',className}:{url:string;frame?:CropFrame|null;alt?:string;className?:string}) {
  const [ready,setReady]=useState(()=>decoded.has(url));
  useEffect(()=>{setReady(decoded.has(url));},[url]);
  const style:CSSProperties=frame&&validFrame(frame)?frameStyle(frame):{};
  return <span className={'ays-portrait-loading'+(ready?' is-ready':'')+(className?' '+className:'')}>
    <img src={url} alt={alt} style={style} draggable={false} loading="eager"
      onLoad={event=>{
        const image=event.currentTarget;
        const source=image.currentSrc;
        void (image.decode?.()??Promise.resolve()).catch(()=>{}).then(()=>{
          if(image.currentSrc===source){decoded.add(url);setReady(true);}
        });
      }} onError={()=>setReady(false)}/>
  </span>;
}

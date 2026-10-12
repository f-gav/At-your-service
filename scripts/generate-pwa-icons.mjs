import {PNG} from 'pngjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=PNG.sync.read(readFileSync(resolve(root,'public/site-icon.png')));
function resize(width,maskable=false) {
  const image=new PNG({width,height:width});
  const scale=maskable?0.76:1;
  const inset=(1-scale)/2;
  for(let y=0;y<width;y++)for(let x=0;x<width;x++) {
    const index=(y*width+x)*4;
    const u=(x+.5)/width,v=(y+.5)/width;
    const sx=(u-inset)/scale,sy=(v-inset)/scale;
    if(maskable) {image.data.set([52,66,81,255],index);}
    else image.data.set([0,0,0,0],index);
    if(sx<0||sx>=1||sy<0||sy>=1)continue;
    const fx=sx*source.width-.5,fy=sy*source.height-.5;
    const x0=Math.max(0,Math.floor(fx)),y0=Math.max(0,Math.floor(fy));
    const x1=Math.min(source.width-1,x0+1),y1=Math.min(source.height-1,y0+1);
    const tx=Math.max(0,Math.min(1,fx-x0)),ty=Math.max(0,Math.min(1,fy-y0));
    // Interpolate premultiplied colors so transparent corners have no halos.
    let total=0,r=0,g=0,b=0;
    for(const [px,py,weight] of [
      [x0,y0,(1-tx)*(1-ty)],[x1,y0,tx*(1-ty)],
      [x0,y1,(1-tx)*ty],[x1,y1,tx*ty],
    ]) {
      const i=(py*source.width+px)*4,a=source.data[i+3]/255;
      const weighted=a*weight;
      total+=weighted;
      r+=source.data[i]*weighted;g+=source.data[i+1]*weighted;b+=source.data[i+2]*weighted;
    }
    if(total<=0)continue;
    const alpha=maskable?1:total;
    if(maskable) {
      image.data[index]=Math.round(r+(52*(1-total)));
      image.data[index+1]=Math.round(g+(66*(1-total)));
      image.data[index+2]=Math.round(b+(81*(1-total)));
    }else {
      image.data[index]=Math.round(r/total);
      image.data[index+1]=Math.round(g/total);
      image.data[index+2]=Math.round(b/total);
    }
    image.data[index+3]=Math.round(alpha*255);
  }
  return PNG.sync.write(image,{colorType:6,compressionLevel:9});
}
for(const size of [192,512])
  writeFileSync(resolve(root,`public/pwa-icon-${size}.png`),resize(size));
writeFileSync(resolve(root,'public/pwa-icon-maskable-512.png'),resize(512,true));
console.log('Generated PWA icons (192, 512, and maskable 512).');

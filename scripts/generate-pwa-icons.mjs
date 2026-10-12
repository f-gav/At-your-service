import {PNG} from 'pngjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// The original temporary site icon has an indexed palette with a tRNS
// chunk longer than its PLTE. Browsers may tolerate that non-standard input,
// but strict decoders (pngjs) reject it. Normalize the tRNS length and CRC
// in memory before rendering PWA icons; preserve the checked-in site icon.
function crc32(buffer) {
  let crc=0xffffffff;
  for(const byte of buffer) {
    crc^=byte;
    for(let bit=0;bit<8;bit++)crc=(crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function normalizeIndexedTransparency(buffer) {
  const signature=buffer.subarray(0,8);
  if(!signature.equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Expected a PNG site icon');
  const chunks=[signature];
  let offset=8;
  let paletteEntries=0;
  while(offset+12<=buffer.length) {
    const length=buffer.readUInt32BE(offset);
    if(offset+12+length>buffer.length)throw Error('Truncated PNG chunk');
    const type=buffer.subarray(offset+4,offset+8).toString('ascii');
    let data=buffer.subarray(offset+8,offset+8+length);
    if(type==='PLTE')paletteEntries=data.length/3;
    if(type==='tRNS' && paletteEntries && data.length>paletteEntries)
      data=data.subarray(0,paletteEntries);
    const header=Buffer.allocUnsafe(8);
    header.writeUInt32BE(data.length,0);
    header.write(type,4,4,'ascii');
    const checksum=Buffer.allocUnsafe(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4),data])),0);
    chunks.push(header,data,checksum);
    offset+=length+12;
    if(type==='IEND')break;
  }
  return Buffer.concat(chunks);
}
const source=PNG.sync.read(normalizeIndexedTransparency(readFileSync(resolve(root,'public/site-icon.png'))));
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

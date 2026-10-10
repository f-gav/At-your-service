/** Crop geometry in source-image pixels. Shared by the live editor and canvas encoder. */
export type CropPosition = { zoom: number; dx: number; dy: number };
export type CropSize = { width: number; height: number };

export function cropGeometry(image: CropSize, viewport: CropSize, crop: CropPosition) {
  const zoom = Math.max(1, Math.min(3, crop.zoom));
  const cover = Math.max(viewport.width / image.width, viewport.height / image.height) * zoom;
  const renderedWidth = image.width * cover;
  const renderedHeight = image.height * cover;
  const maxX = Math.max(0, (renderedWidth - viewport.width) / 2);
  const maxY = Math.max(0, (renderedHeight - viewport.height) / 2);
  const dx = Math.max(-maxX, Math.min(maxX, crop.dx));
  const dy = Math.max(-maxY, Math.min(maxY, crop.dy));
  return { renderedWidth, renderedHeight, dx, dy,
    sx: (renderedWidth - viewport.width) / (2 * cover) - dx / cover,
    sy: (renderedHeight - viewport.height) / (2 * cover) - dy / cover,
    sw: viewport.width / cover, sh: viewport.height / cover };
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve,reject) => canvas.toBlob(blob => {
    if (!blob || blob.type !== 'image/webp') reject(new Error('Браузер не поддерживает экспорт WebP. Попробуй другой браузер.'));
    else resolve(blob);
  }, 'image/webp', quality));
}

export async function croppedWebp(
  image: HTMLImageElement, viewport: CropSize, crop: CropPosition, output: CropSize,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = output.width; canvas.height = output.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось подготовить изображение.');
  const geometry = cropGeometry({width:image.naturalWidth,height:image.naturalHeight},viewport,crop);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image,geometry.sx,geometry.sy,geometry.sw,geometry.sh,0,0,output.width,output.height);
  for (const q of [.84,.74,.63,.52]) {
    const blob = await encode(canvas,q);
    if (blob.size <= 400000) return blob;
  }
  throw new Error('Не удалось сжать изображение до 400 КБ. Выбери другую картинку.');
}

/** Coordinates of a crop in fractions of the full optimized source image. */
export type CropFrame={x:number;y:number;w:number;h:number};
export type PortraitCrops={card:CropFrame;sheet:CropFrame};
export function frameFromCrop(source:CropSize,viewport:CropSize,position:CropPosition):CropFrame {
  const g=cropGeometry(source,viewport,position);
  const clamp=(n:number)=>Math.max(0,Math.min(1,n));
  return {
    x:clamp(g.sx/source.width),y:clamp(g.sy/source.height),
    w:clamp(g.sw/source.width),h:clamp(g.sh/source.height),
  };
}
export function validFrame(value:unknown):value is CropFrame{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const f=value as CropFrame;
  return [f.x,f.y,f.w,f.h].every(x=>typeof x==='number'&&Number.isFinite(x)) &&
    f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=1.002&&f.y+f.h<=1.002;
}
export function validCrops(value:unknown):value is PortraitCrops{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const p=value as PortraitCrops;return validFrame(p.card)&&validFrame(p.sheet);
}
/** Draw exactly one source file with a distinct non-destructive crop in each view. */
export function frameStyle(f:CropFrame){
  return {
    position:'absolute' as const,
    width:(100/f.w)+'%',height:(100/f.h)+'%',
    maxWidth:'none',objectFit:'fill' as const,
    left:(-100*f.x/f.w)+'%',top:(-100*f.y/f.h)+'%',
    transform:'none',
  };
}
/** Preserve the entire input frame, optimize for browsers/storage. No crop data is baked in. */
export async function optimizedSourceWebp(image:HTMLImageElement):Promise<Blob>{
  for(const maxEdge of [1280,1120,960,820]){
    const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Не удалось подготовить портрет.');
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.86,.78,.70,.62,.54]){
      const blob=await encode(canvas,quality);
      if(blob.size<=350000)return blob;
    }
  }
  throw new Error('Не удалось оптимизировать портрет до 350 КБ. Попробуй другую картинку.');
}

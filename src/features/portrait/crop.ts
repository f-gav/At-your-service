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

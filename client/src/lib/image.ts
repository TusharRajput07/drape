// Photo handling for uploads (03 §6.4, §9): decode, resize, rotate, transparency check, trim, compress.

// Decodes a picked file onto a canvas (long side at most `max`). Browsers apply the photo's EXIF orientation
// when decoding, so it is never sideways. HEIC and other formats the browser can't read reject here.
export async function decodeToCanvas(file: Blob, max: number) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return toCanvas(img, max);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

// Draws an image onto a new canvas, scaled down so the long side is at most `max`.
export function toCanvas(src: CanvasImageSource & { width: number; height: number }, max: number) {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const c = canvas(src.width * scale, src.height * scale);
  ctx2d(c).drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// A quarter turn clockwise.
export function rotateClockwise(src: HTMLCanvasElement) {
  const c = canvas(src.height, src.width);
  const ctx = ctx2d(c);
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

// True when more than 1% of sampled pixels are already see-through (03 §9).
export function hasTransparency(c: HTMLCanvasElement) {
  const p = ctx2d(c).getImageData(0, 0, c.width, c.height).data;
  let clear = 0;
  let n = 0;
  for (let i = 3; i < p.length; i += 16) {
    n++;
    if (p[i]! < 250) clear++;
  }
  return clear / n > 0.01;
}

// Crops away the see-through border around a cutout, keeping a small margin (as in the prototype).
export function trimTransparent(src: HTMLCanvasElement) {
  const { width: w, height: h } = src;
  const p = ctx2d(src).getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (p[(y * w + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const pad = Math.round(Math.max(cw, ch) * 0.04);
  const c = canvas(cw + pad * 2, ch + pad * 2);
  ctx2d(c).drawImage(src, minX, minY, cw, ch, pad, pad, cw, ch);
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));
}

// WebP at most `max` px on the long side, quality 0.85; PNG when the browser can't write WebP.
export async function compress(src: HTMLCanvasElement, max: number) {
  const c = Math.max(src.width, src.height) > max ? toCanvas(src, max) : src;
  const webp = await toBlob(c, 'image/webp', 0.85);
  if (webp?.type === 'image/webp') return webp;
  const png = await toBlob(c, 'image/png');
  if (!png) throw new Error('Could not encode the photo');
  return png;
}

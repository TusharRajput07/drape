import type { Color } from './api-types';

// Nearest-palette colour detection, ported from the prototype (03 §9).

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

// The palette colour closest to an RGB value (redmean distance).
function nearest(palette: { id: string; rgb: Rgb }[], r: number, g: number, b: number) {
  let best = palette[0]!.id;
  let bestDistance = Infinity;
  for (const {
    id,
    rgb: [cr, cg, cb],
  } of palette) {
    const rm = (r + cr) / 2;
    const dr = r - cr;
    const dg = g - cg;
    const db = b - cb;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestDistance) {
      bestDistance = d;
      best = id;
    }
  }
  return best;
}

// The most common palette colour among the opaque pixels; null when there are none.
export function detectColor(c: HTMLCanvasElement, colors: Color[]): string | null {
  if (!colors.length) return null;
  const palette = colors.map((col) => ({ id: col.id, rgb: rgb(col.hex) }));
  const { width: w, height: h } = c;
  const p = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)));
  const counts = new Map<string, number>();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const o = (y * w + x) * 4;
      // Pixel data is always in range: ! only tells TypeScript so.
      if (p[o + 3]! < 200) continue;
      const id = nearest(palette, p[o]!, p[o + 1]!, p[o + 2]!);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((n, id) => {
    if (n > bestCount) {
      bestCount = n;
      best = id;
    }
  });
  return best;
}

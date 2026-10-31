import type { Config } from '@imgly/background-removal';
import { useSyncExternalStore } from 'react';
import { decodeToCanvas, trimTransparent } from '@/lib/image';

// Background removal in the browser (03 §9): @imgly/background-removal, default model, WebGPU with the
// library's automatic CPU fallback. The library is only downloaded when an upload preview opens.
// Its model and WASM files come from img.ly's CDN; the service worker caches them (03 §10).

type Status = { ready: boolean; loading: boolean; fraction: number };

let status: Status = { ready: false, loading: false, fraction: 0 };
const listeners = new Set<() => void>();
const set = (next: Partial<Status>) => {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
};

// Download progress per file; the model is most of it.
const downloads = new Map<string, { done: number; total: number }>();

// One config object for every call: the library loads the model once per config and reuses it.
const CONFIG: Config = {
  device: 'gpu',
  model: 'isnet_fp16',
  output: { format: 'image/png' },
  progress: (key, done, total) => {
    if (!key.startsWith('fetch:')) return;
    downloads.set(key, { done, total });
    let d = 0;
    let t = 0;
    downloads.forEach((v) => {
      d += v.done;
      t += v.total;
    });
    set({ fraction: t ? d / t : 0 });
  },
};

let lib: Promise<typeof import('@imgly/background-removal')> | null = null;
let preloading: Promise<void> | null = null;

// Loads the library and the model (once per session).
function prepare() {
  preloading ??= (async () => {
    set({ loading: true });
    try {
      lib ??= import('@imgly/background-removal');
      await (await lib).preload(CONFIG);
      set({ ready: true });
    } catch (err) {
      preloading = null;
      throw err;
    } finally {
      set({ loading: false });
    }
  })();
  return preloading;
}

async function run(photo: HTMLCanvasElement) {
  await prepare();
  const input = await new Promise<Blob | null>((resolve) => photo.toBlob(resolve, 'image/png'));
  if (!input) throw new Error('Could not read the photo');
  const output = await (await lib!).removeBackground(input, CONFIG);
  return trimTransparent(await decodeToCanvas(output, Math.max(photo.width, photo.height)));
}

// The model can run only one photo at a time, so removals wait in line. Asking twice for the same photo
// (React runs effects twice in development) reuses the first answer.
let queue: Promise<unknown> = Promise.resolve();
const results = new WeakMap<HTMLCanvasElement, Promise<HTMLCanvasElement>>();

// Returns the photo with its background removed, trimmed to the garment.
export function removeBackground(photo: HTMLCanvasElement) {
  let result = results.get(photo);
  if (!result) {
    result = queue.then(() => run(photo));
    queue = result.catch(() => undefined);
    results.set(photo, result);
    // A failed removal can be tried again.
    result.catch(() => results.delete(photo));
  }
  return result;
}

// Starts loading early (when the preview opens), without waiting for it.
export function warmUpBackgroundRemoval() {
  // The user is told when a removal is actually attempted.
  prepare().catch((err: unknown) => console.error(err));
}

export function useBackgroundRemovalStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

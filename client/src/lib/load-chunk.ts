// Loads a lazy page's code (03 §3). After a new deploy, a tab that is still open on the old app may ask
// for a file that no longer exists: then the page reloads (at most once a minute) to pick up the new
// app, instead of ending on the router's error screen. Offline, it waits for the connection and retries.

const RELOADED_AT = 'drape:chunk-reload';
const MIN_GAP_MS = 60 * 1000;

// Remembers the reload; false when one happened less than a minute ago (or storage is blocked), so a
// file that is really missing can't cause a reload loop.
function mayReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT));
    if (last && Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((err: unknown) => {
    if (!navigator.onLine) {
      return new Promise<T>((resolve, reject) => {
        window.addEventListener('online', () => loadChunk(load).then(resolve, reject), {
          once: true,
        });
      });
    }
    if (!mayReload()) throw err;
    window.location.reload();
    return new Promise<T>(() => {}); // the page is going away
  });
}

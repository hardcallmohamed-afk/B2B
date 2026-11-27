import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_PREFIX = 'op_chunk_reload_v1_';

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const name =
    typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name || '') : '';
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message || '')
        : String(err);
  const combined = `${name} ${msg}`.toLowerCase();
  return (
    combined.includes('chunkloaderror') ||
    combined.includes('loading chunk') ||
    combined.includes('failed to fetch dynamically imported module') ||
    combined.includes('importing a module script failed') ||
    combined.includes('error loading dynamically imported module')
  );
}

/**
 * Wraps React.lazy dynamic imports with a single automatic reload on stale chunk errors
 * (e.g. after a GitHub Pages deployment invalidates previous hashed asset filenames).
 * Uses a sessionStorage guard per chunk to guarantee zero reload loops.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkKey: string
): LazyExoticComponent<T> {
  const guardKey = `${CHUNK_RELOAD_PREFIX}${chunkKey}`;

  return lazy(async () => {
    try {
      const mod = await importer();
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(guardKey);
        } catch {
          // Ignore storage errors in restricted environments
        }
      }
      return mod;
    } catch (err) {
      if (typeof window !== 'undefined' && isChunkLoadError(err)) {
        let alreadyRetried = false;
        try {
          alreadyRetried = window.sessionStorage.getItem(guardKey) === '1';
          if (!alreadyRetried) {
            window.sessionStorage.setItem(guardKey, '1');
          }
        } catch {
          alreadyRetried = true;
        }

        if (!alreadyRetried) {
          window.location.reload();
          // Keep Suspense fallback mounted while the page reloads cleanly
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}

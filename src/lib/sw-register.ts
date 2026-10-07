// Service worker registration (FR-024): detect a waiting worker, let the UI
// offer "Update", and only then post SKIP_WAITING. The reload keeps the token
// (IndexedDB) and the route, so the person stays signed in and on the same base.

export type UpdateHandle = { apply: () => void };

type Options = {
  onUpdate: (handle: UpdateHandle) => void;
  url?: string;
};

export async function registerServiceWorker({ onUpdate, url = '/sw.js' }: Options): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (import.meta.env?.DEV) return null;
  try {
    const reg = await navigator.serviceWorker.register(url, { scope: '/' });
    const offer = (worker: ServiceWorker) => {
      onUpdate({
        apply: () => worker.postMessage({ type: 'SKIP_WAITING' }),
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) offer(installing);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    return reg;
  } catch {
    return null;
  }
}

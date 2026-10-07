// Install-related helpers shared by InstallButton, IosInstallHint and the
// callback screen.
import * as React from 'react';

export function isStandalone(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function isIos(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const l of promptListeners) l(deferredPrompt);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const l of promptListeners) l(null);
  });
}

export function useInstallPrompt(): BeforeInstallPromptEvent | null {
  const [p, setP] = React.useState(deferredPrompt);
  React.useEffect(() => {
    promptListeners.add(setP);
    setP(deferredPrompt);
    return () => {
      promptListeners.delete(setP);
    };
  }, []);
  return p;
}

/** Tests only. */
export function _setDeferredPromptForTests(e: BeforeInstallPromptEvent | null) {
  deferredPrompt = e;
  for (const l of promptListeners) l(e);
}

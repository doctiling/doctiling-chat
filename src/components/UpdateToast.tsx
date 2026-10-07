import * as React from 'react';
import { useToast } from './Toast';
import { useLanguage } from '@/i18n/use-language';
import { registerServiceWorker } from '@/lib/sw-register';

/** Registers the SW once and shows the "Update" toast when a new version waits. */
export function UpdateToast() {
  const { t } = useLanguage();
  const { push } = useToast();
  // Register once; the toast copy is resolved at push time with the latest t.
  const latest = React.useRef({ t, push });
  latest.current = { t, push };
  React.useEffect(() => {
    void registerServiceWorker({
      onUpdate: (handle) => {
        const { t: tt, push: pp } = latest.current;
        pp({
          message: tt('pwa.updateAvailable'),
          duration: 0,
          action: { label: tt('pwa.update'), hint: tt('pwa.updateHint'), onClick: handle.apply },
        });
      },
    });
  }, []);
  return null;
}

import * as React from 'react';
import { useToast } from './Toast';
import { useLanguage } from '../i18n/use-language';
import { useChat } from '../lib/chat-context';
import { registerServiceWorker } from '../lib/sw-register';

/** Registers the SW once (under the host's basePath) and shows the "Update" toast when a new version waits. */
export function UpdateToast() {
  const { t } = useLanguage();
  const { push } = useToast();
  const { basePath } = useChat();
  // Register once; the toast copy is resolved at push time with the latest t.
  const latest = React.useRef({ t, push });
  latest.current = { t, push };
  React.useEffect(() => {
    const base = basePath.replace(/\/+$/, '');
    void registerServiceWorker({
      url: `${base}/sw.js`,
      scope: `${base}/`,
      onUpdate: (handle) => {
        const { t: tt, push: pp } = latest.current;
        pp({
          message: tt('pwa.updateAvailable'),
          duration: 0,
          action: { label: tt('pwa.update'), hint: tt('pwa.updateHint'), onClick: handle.apply },
        });
      },
    });
  }, [basePath]);
  return null;
}

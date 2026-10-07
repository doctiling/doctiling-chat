import * as React from 'react';
import { Share } from 'lucide-react';
import { useLanguage } from '@/i18n/use-language';
import { getPrefs, setPrefs } from '@/lib/storage';
import { isIos, isStandalone } from '@/lib/pwa';

// FR-025: the iOS instructions appear only outside the installed mode, in the
// UI language, and can be dismissed (pref, cleared on sign-out).
export function IosInstallHint() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = React.useState(() => getPrefs().iosHintDismissed === true);
  if (dismissed || isStandalone() || !isIos()) return null;
  return (
    <aside
      data-testid="ios-install-hint"
      className="mx-4 my-3 flex gap-3 rounded-xl border border-border bg-card p-3 text-sm text-cardForeground"
    >
      <Share className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium">{t('pwa.ios.title')}</p>
        <p className="mt-1 text-mutedForeground">{t('pwa.ios.body')}</p>
        <button
          type="button"
          className="mt-2 min-h-touch px-1 font-medium text-primary"
          onClick={() => {
            setPrefs({ iosHintDismissed: true });
            setDismissed(true);
          }}
        >
          {t('pwa.ios.dismiss')}
        </button>
      </div>
    </aside>
  );
}

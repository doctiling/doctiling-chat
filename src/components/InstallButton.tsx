import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { useLanguage } from '../i18n/use-language';
import { isStandalone, useInstallPrompt } from '../lib/install';

/** Shown only when the browser offered `beforeinstallprompt` and we are not installed. */
export function InstallButton({ full = false }: { full?: boolean }) {
  const { t } = useLanguage();
  const prompt = useInstallPrompt();
  const [busy, setBusy] = React.useState(false);
  if (!prompt || isStandalone()) return null;
  return (
    <SimpleTooltip label={t('pwa.installHint')}>
      <Button
        variant="outline"
        size="lg"
        className={full ? 'w-full' : ''}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await prompt.prompt();
            await prompt.userChoice;
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download strokeWidth={1.75} aria-hidden="true" />
        {t('pwa.install')}
      </Button>
    </SimpleTooltip>
  );
}

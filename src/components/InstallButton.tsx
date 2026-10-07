import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { useLanguage } from '@/i18n/use-language';
import { isStandalone, useInstallPrompt } from '@/lib/pwa';

/** Shown only when the browser offered `beforeinstallprompt` and we are not installed. */
export function InstallButton({ full = false }: { full?: boolean }) {
  const { t } = useLanguage();
  const prompt = useInstallPrompt();
  const [busy, setBusy] = React.useState(false);
  if (!prompt || isStandalone()) return null;
  return (
    <Tooltip label={t('pwa.installHint')}>
      <Button
        variant="secondary"
        full={full}
        pending={busy}
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
        <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {t('pwa.install')}
      </Button>
    </Tooltip>
  );
}

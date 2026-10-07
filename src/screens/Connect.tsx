import * as React from 'react';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/Button';
import { Tooltip } from '@/components/Tooltip';
import { InstallButton } from '@/components/InstallButton';
import { IosInstallHint } from '@/components/IosInstallHint';
import { useLanguage } from '@/i18n/use-language';
import { config } from '@/config';
import { startConnect } from '@/lib/connect';
import type { SignOutReason } from '@/lib/api';

type Props = {
  /** Why the person is here after having been connected (401 or sign-out). */
  reason?: SignOutReason | null;
  navigate?: (url: string) => void;
};

export function Connect({ reason, navigate }: Props) {
  const { t, language } = useLanguage();
  const [pending, setPending] = React.useState(false);
  const guard = React.useRef(false);
  const [showSteps, setShowSteps] = React.useState(false);
  const host = (() => {
    try {
      return new URL(config().apiOrigin).host;
    } catch {
      return '';
    }
  })();

  const connect = async () => {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    try {
      await startConnect(language, navigate);
    } finally {
      // The top-level navigation unloads the page; if it did not (tests, popup blocked) release.
      window.setTimeout(() => {
        guard.current = false;
        setPending(false);
      }, 2000);
    }
  };

  return (
    <main className="app-shell">
      <div className="scroll-area flex flex-col">
        <IosInstallHint />
        <div className="flex flex-1 flex-col justify-center px-6 py-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primaryForeground">
            <MessageSquareText className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium uppercase tracking-widest text-mutedForeground">{t('app.name')}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">{t('connect.title')}</h1>
          <p className="mt-4 text-base text-mutedForeground">{host ? t('connect.lead', { host }) : t('connect.leadNoHost')}</p>
          {reason && (
            <p role="status" className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-sm text-cardForeground">
              {t(`connect.signedOut.${reason}`)}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3">
            <Tooltip label={t('connect.buttonHint')}>
              <Button full pending={pending} onClick={() => void connect()} data-testid="connect-button">
                {pending ? t('connect.connecting') : t('connect.button')}
              </Button>
            </Tooltip>
            <InstallButton full />
            <button
              type="button"
              className="min-h-touch text-sm font-medium text-primary underline-offset-4 hover:underline"
              aria-expanded={showSteps}
              onClick={() => setShowSteps((s) => !s)}
            >
              {t('connect.howItWorks')}
            </button>
            {showSteps && (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-mutedForeground">
                <li>{t('connect.steps.one')}</li>
                <li>{t('connect.steps.two')}</li>
                <li>{t('connect.steps.three')}</li>
              </ol>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

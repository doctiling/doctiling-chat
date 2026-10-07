import * as React from 'react';
import { Button } from '@/components/Button';
import { Tooltip } from '@/components/Tooltip';
import { useLanguage } from '@/i18n/use-language';
import { CallbackError, handleCallback, type CallbackErrorCode } from '@/lib/connect';
import { isStandalone } from '@/lib/pwa';
import { navigate, paths } from '@/lib/router';
import { setPrefs } from '@/lib/storage';

type Props = {
  url?: string;
  onConnected?: () => void;
  standalone?: boolean;
};

export function Callback({ url, onConnected, standalone = isStandalone() }: Props) {
  const { t } = useLanguage();
  const [state, setState] = React.useState<{ status: 'working' | 'done' | 'error'; code?: CallbackErrorCode }>({ status: 'working' });
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    handleCallback(url ?? window.location.href)
      .then(() => {
        setPrefs({});
        setState({ status: 'done' });
        if (onConnected) onConnected();
        else navigate(paths.kbs(), { replace: true });
      })
      .catch((e: unknown) => {
        setState({ status: 'error', code: e instanceof CallbackError ? e.code : 'unknown' });
      });
  }, [url, onConnected]);

  return (
    <main className="app-shell">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">{t('connect.callback.title')}</h1>
        {state.status === 'working' && (
          <p role="status" className="mt-3 text-mutedForeground">
            {t('connect.callback.working')}
          </p>
        )}
        {state.status === 'done' && (
          <p role="status" className="mt-3 text-mutedForeground">
            {t('connect.callback.done')}
          </p>
        )}
        {state.status === 'error' && (
          <>
            <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm text-destructive">
              {t(`connect.errors.${state.code ?? 'unknown'}`)}
            </p>
            <Button className="mt-6" full onClick={() => navigate(paths.connect(), { replace: true })}>
              {t('connect.callback.tryAgain')}
            </Button>
          </>
        )}
        {/* iOS risk (plan § Risks): Safari may open the callback outside the installed app. */}
        {!standalone && (
          <div className="mt-8 rounded-xl border border-border bg-card p-4 text-sm text-cardForeground">
            <p className="text-mutedForeground">{t('connect.callback.openInAppHint')}</p>
            <Tooltip label={t('connect.callback.openInAppHint')}>
              <Button
                variant="secondary"
                className="mt-3"
                full
                onClick={() => window.location.assign(`${window.location.origin}${paths.connect()}`)}
                data-testid="open-in-app"
              >
                {t('connect.callback.openInApp')}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </main>
  );
}

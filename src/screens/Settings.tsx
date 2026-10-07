import * as React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { InstallButton } from '@/components/InstallButton';
import { Tooltip } from '@/components/Tooltip';
import { LANGUAGES } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';
import { config } from '@/config';
import { api, ApiError, signOut, type MeView } from '@/lib/api';
import { navigate, paths } from '@/lib/router';
import { clearAll } from '@/lib/storage';

export function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [me, setMe] = React.useState<MeView | null>(null);
  const [error, setError] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const guard = React.useRef(false);

  React.useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(true);
      });
  }, []);

  const leave = async () => {
    if (guard.current) return;
    guard.current = true;
    setLeaving(true);
    try {
      await api.revoke();
    } catch {
      /* the server may already consider us gone; local clean-up still happens */
    } finally {
      await clearAll();
      await signOut('self');
      // The guard stays armed: the app leaves this screen; a late second tap must not revoke twice.
    }
  };

  const version = (() => {
    try {
      return config().version;
    } catch {
      return 'dev';
    }
  })();

  return (
    <main className="app-shell">
      <header className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <IconButton label={t('app.back')} onClick={() => navigate(paths.kbs())}>
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </IconButton>
        <h1 className="font-display text-lg font-semibold">{t('settings.title')}</h1>
      </header>
      <div className="scroll-area safe-bottom px-4 py-4">
        <section className="rounded-xl border border-border bg-card p-4 text-cardForeground">
          <h2 className="text-xs font-medium uppercase tracking-widest text-mutedForeground">{t('settings.account')}</h2>
          {me ? (
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="sr-only">Email</dt>
                <dd className="font-medium">{me.name ? `${me.name} · ${me.email}` : me.email}</dd>
              </div>
              <div className="flex gap-1 text-mutedForeground">
                <dt>{t('settings.tenant')}:</dt>
                <dd>
                  {me.tenant.name} ({me.tenant.host}) · {t(`settings.role.${me.role}`)}
                </dd>
              </div>
              <div className="text-mutedForeground">
                <dd>{t('settings.sessionUntil', { date: new Date(me.limits.tokenExpiresAt).toLocaleDateString(language) })}</dd>
              </div>
            </dl>
          ) : error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {t('settings.loadFailed')}
            </p>
          ) : (
            <p role="status" className="mt-2 text-sm text-mutedForeground">
              {t('app.loading')}
            </p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-4 text-cardForeground">
          <h2 className="text-xs font-medium uppercase tracking-widest text-mutedForeground">{t('settings.language')}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.language')}>
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                className={`min-h-touch rounded-lg border px-3 text-sm font-medium ${
                  language === l ? 'border-primary bg-primary text-primaryForeground' : 'border-border bg-background'
                }`}
                onClick={() => setLanguage(l)}
              >
                {t(`settings.languages.${l}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm text-cardForeground">
          <span className="text-mutedForeground">{t('settings.version')}</span>
          <span data-testid="version">{version}</span>
        </section>

        <div className="mt-4">
          <InstallButton full />
        </div>

        <div className="mt-6">
          <Tooltip label={t('settings.signOutHint')}>
            <Button variant="destructive" full pending={leaving} onClick={() => void leave()} data-testid="sign-out">
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {leaving ? t('settings.signingOut') : t('settings.signOut')}
            </Button>
          </Tooltip>
        </div>
      </div>
    </main>
  );
}

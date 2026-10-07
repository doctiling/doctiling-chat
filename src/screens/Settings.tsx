import * as React from 'react';
import { ArrowLeft, ExternalLink, LogOut } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { IconButton } from '../components/IconButton';
import { InstallButton } from '../components/InstallButton';
import { LANGUAGES, type Language } from '../i18n';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type MeView } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { navigate } from '../lib/router';

/** The same route under the other locale's basePath, or null when basePath carries no locale segment. */
export function localeHref(basePath: string, pathname: string, target: Language): string | null {
  const m = /\/(en|es)(?=\/|$)/.exec(basePath);
  if (!m || m[1] === target) return null;
  const otherBase = `${basePath.slice(0, m.index)}/${target}${basePath.slice(m.index + m[0].length)}`;
  const rel = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : '';
  return `${otherBase}${rel}`;
}

export function Settings() {
  const { t, language } = useLanguage();
  const { api, paths, basePath, signOutHref, studioHref, version } = useChat();
  const [me, setMe] = React.useState<MeView | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && (e.status === 401 || e.status === 404))) setError(true);
      });
  }, [api]);

  const pathname = typeof window === 'undefined' ? basePath : window.location.pathname;

  return (
    <main className="app-shell">
      <header className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <IconButton label={t('app.back')} onClick={() => navigate(paths.kbs())} className="md:hidden">
          <ArrowLeft strokeWidth={1.75} />
        </IconButton>
        <h1 className="font-display text-lg font-semibold md:px-2">{t('settings.title')}</h1>
      </header>
      <div className="scroll-area safe-bottom px-4 py-4">
        <div className="mx-auto w-full md:max-w-[760px]">
        <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('settings.account')}</h2>
          {me ? (
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="sr-only">Email</dt>
                <dd className="font-medium">{me.name ? `${me.name} · ${me.email}` : me.email}</dd>
              </div>
              <div className="flex gap-1 text-muted-foreground">
                <dt>{t('settings.tenant')}:</dt>
                <dd>
                  {me.tenant.name} ({me.tenant.host}) · {t(`settings.role.${me.role}`)}
                </dd>
              </div>
            </dl>
          ) : error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {t('settings.loadFailed')}
            </p>
          ) : (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {t('app.loading')}
            </p>
          )}
          <a href={studioHref} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t('settings.openStudio')}
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </a>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('settings.language')}</h2>
          <nav className="mt-2 grid grid-cols-2 gap-2" aria-label={t('settings.language')}>
            {LANGUAGES.map((l) => {
              const href = localeHref(basePath, pathname, l);
              const current = language === l;
              const cls = `inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 text-sm font-medium ${
                current ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'
              }`;
              return current || !href ? (
                <span key={l} aria-current={current ? 'true' : undefined} className={cls}>
                  {t(`settings.languages.${l}`)}
                </span>
              ) : (
                <a key={l} href={href} hrefLang={l} lang={l} className={cls} data-testid={`language-${l}`}>
                  {t(`settings.languages.${l}`)}
                </a>
              );
            })}
          </nav>
        </section>

        <section className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
          <span className="text-muted-foreground">{t('settings.version')}</span>
          <span data-testid="version">{version}</span>
        </section>

        <div className="mt-4">
          <InstallButton full />
        </div>

        <div className="mt-6">
          <SimpleTooltip label={t('settings.signOutHint')}>
            <Button asChild variant="destructive" size="lg" className="w-full">
              <a href={signOutHref} data-testid="sign-out">
                <LogOut strokeWidth={1.75} aria-hidden="true" />
                {t('settings.signOut')}
              </a>
            </Button>
          </SimpleTooltip>
        </div>
        </div>
      </div>
    </main>
  );
}

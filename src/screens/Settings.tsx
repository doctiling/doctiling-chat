import * as React from 'react';
import { ArrowLeft, ExternalLink, LogOut, Moon, MonitorSmartphone, Sun } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { IconButton } from '../components/IconButton';
import { InstallButton } from '../components/InstallButton';
import { LANGUAGES, type Language } from '../i18n';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type MeView, type TimezoneView } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { navigate } from '../lib/router';
import { useSpeech } from '../lib/speech';
import { getPrefs, setPrefs } from '../lib/storage';
import { getThemePreference, setThemePreference, THEME_PREFERENCES, type ThemePreference } from '../lib/theme';

const THEME_ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: MonitorSmartphone };

// spec 068 FR-028..030: a device preference (never on the server), applied at once, no reload.
function ThemeSection() {
  const { t } = useLanguage();
  const [pref, setPref] = React.useState<ThemePreference>(() => getThemePreference());
  const choose = (next: ThemePreference) => {
    setPref(next);
    setThemePreference(next);
  };
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground" data-testid="theme-section">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('settings.theme.title')}</h2>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={t('settings.theme.title')}>
        {THEME_PREFERENCES.map((p) => {
          const Icon = THEME_ICONS[p];
          const current = pref === p;
          return (
            <SimpleTooltip key={p} label={t(`settings.theme.${p}Hint`)}>
              <button
                type="button"
                aria-pressed={current}
                aria-current={current ? 'true' : undefined}
                onClick={() => choose(p)}
                data-testid={`theme-${p}`}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                  current ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {t(`settings.theme.${p}`)}
              </button>
            </SimpleTooltip>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.theme.hint')}</p>
    </section>
  );
}

/** Zones the device knows; a short list where `Intl.supportedValuesOf` is missing (older WebKit). */
const FALLBACK_ZONES = ['UTC', 'America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/Madrid', 'Europe/London', 'Europe/Berlin'];

export function timeZoneOptions(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch {
    /* unsupported: fall back */
  }
  return FALLBACK_ZONES;
}

const INSTANCE = '';

// spec 068 US6: the person's zone is a studio-wide preference; the chat edits it through the same route.
function TimezoneSection() {
  const { t } = useLanguage();
  const { api } = useChat();
  const [view, setView] = React.useState<TimezoneView | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'saving' | 'loadFailed' | 'saveFailed'>('loading');
  const zones = React.useMemo(timeZoneOptions, []);

  React.useEffect(() => {
    let alive = true;
    api
      .timezone()
      .then((v) => {
        if (!alive) return;
        setView(v);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('loadFailed');
      });
    return () => {
      alive = false;
    };
  }, [api]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value === INSTANCE ? null : e.target.value;
    setStatus('saving');
    api
      .setTimezone(next)
      .then((v) => {
        setView(v);
        setStatus('ready');
      })
      .catch(() => setStatus('saveFailed'));
  };

  const options = React.useMemo(() => {
    const chosen = view?.timezone;
    return chosen && !zones.includes(chosen) ? [chosen, ...zones] : zones;
  }, [zones, view?.timezone]);

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground" data-testid="timezone-section">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('settings.timezone.title')}</h2>
      <label className="mt-2 block text-sm">
        <span className="sr-only">{t('settings.timezone.title')}</span>
        <select
          data-testid="timezone-select"
          value={view?.timezone ?? INSTANCE}
          onChange={onChange}
          disabled={!view || status === 'saving'}
          className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-foreground"
        >
          <option value={INSTANCE}>{t('settings.timezone.instance', { zone: view?.instanceTimezone ?? '…' })}</option>
          {options.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      {status === 'loadFailed' || status === 'saveFailed' ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t(status === 'saveFailed' ? 'settings.timezone.saveFailed' : 'settings.timezone.loadFailed')}
        </p>
      ) : (
        <p role="status" className="mt-2 text-sm text-muted-foreground" data-testid="timezone-effective">
          {view ? t('settings.timezone.effective', { zone: view.effective }) : t('app.loading')}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.timezone.hint')}</p>
    </section>
  );
}

/** The same route under the other locale's basePath, or null when basePath carries no locale segment. */
export function localeHref(basePath: string, pathname: string, target: Language): string | null {
  const m = /\/(en|es)(?=\/|$)/.exec(basePath);
  if (!m || m[1] === target) return null;
  const otherBase = `${basePath.slice(0, m.index)}/${target}${basePath.slice(m.index + m[0].length)}`;
  const rel = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : '';
  return `${otherBase}${rel}`;
}

function VoiceSection() {
  const { t } = useLanguage();
  const { supported } = useSpeech();
  const [on, setOn] = React.useState(() => !!getPrefs().voiceReplies);
  const toggle = () => {
    const next = !on;
    setOn(next);
    setPrefs({ voiceReplies: next });
  };
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground" data-testid="voice-section">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('settings.voice.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{supported ? t('settings.voice.body') : t('settings.voice.unsupported')}</p>
      {supported && (
        <label className="mt-3 flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium">
          {t('settings.voice.toggle')}
          <input type="checkbox" role="switch" checked={on} onChange={toggle} className="h-5 w-5" />
        </label>
      )}
    </section>
  );
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
          <a href={studioHref} onClick={() => setPrefs({ entry: 'studio' })} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
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

        <ThemeSection />

        <TimezoneSection />

        <VoiceSection />

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

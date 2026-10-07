import * as React from 'react';
import { BookOpen, ChevronRight, Hourglass, Loader2, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { IosInstallHint } from '../components/IosInstallHint';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type KnowledgeBaseItem } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { reportNetworkFailure, reportNetworkSuccess } from '../lib/online';
import { navigate } from '../lib/router';
import { setPrefs } from '../lib/storage';

export function KnowledgeBases() {
  const { t } = useLanguage();
  const { api, paths } = useChat();
  const [items, setItems] = React.useState<KnowledgeBaseItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.knowledgeBases();
      reportNetworkSuccess();
      setItems(res.items);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network') reportNetworkFailure();
      if (!(e instanceof ApiError && (e.status === 401 || e.code === 'chat_disabled'))) setError(t('kb.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  React.useEffect(() => {
    void load();
    // FR: reload when the app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return (
    <main className="app-shell">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{t('kb.title')}</h1>
          <p className="truncate text-xs text-muted-foreground">{t('kb.subtitle')}</p>
        </div>
        <div className="flex items-center">
          <IconButton label={t('kb.refresh')} onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} strokeWidth={1.75} />
          </IconButton>
          <IconButton label={t('app.openSettings')} onClick={() => navigate(paths.settings())}>
            <SettingsIcon strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>
      <OfflineBanner onRetry={() => void load()} />
      <div className="scroll-area">
        <IosInstallHint />
        {items === null && !error && (
          <p role="status" className="px-4 py-8 text-center text-muted-foreground">
            {t('app.loading')}
          </p>
        )}
        {error && (
          <div className="px-4 py-8 text-center">
            <p role="alert" className="text-destructive">
              {error}
            </p>
            <button type="button" className="mt-3 min-h-[44px] px-4 font-medium text-primary" onClick={() => void load()}>
              {t('app.retry')}
            </button>
          </div>
        )}
        {items && items.length === 0 && (
          <section className="flex flex-col items-center px-8 py-16 text-center" data-testid="kb-empty">
            <BookOpen className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold">{t('kb.empty.title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('kb.empty.body')}</p>
          </section>
        )}
        {items && items.length > 0 && (
          <ul className="divide-y divide-border">
            {items.map((kb) => (
              <li key={kb.id}>
                <button
                  type="button"
                  className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted active:bg-muted"
                  onClick={() => {
                    setPrefs({ lastKbId: kb.id });
                    navigate(paths.conversation(kb.id));
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{kb.name}</span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                        {t(`kb.role.${kb.role}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {kb.description || (kb.documentCount === 1 ? t('kb.documentsOne') : t('kb.documents', { count: kb.documentCount }))}
                    </p>
                    {(kb.hasPending || kb.isRunning) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                        {kb.isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Hourglass className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        )}
                        {kb.isRunning ? t('kb.running') : t('kb.pending')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

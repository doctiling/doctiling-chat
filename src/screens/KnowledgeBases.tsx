import * as React from 'react';
import { BookOpen, ChevronRight, Hourglass, Layers, Loader2, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { InstallButton } from '../components/InstallButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { IosInstallHint } from '../components/IosInstallHint';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type KnowledgeBaseItem } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { reportNetworkFailure, reportNetworkSuccess } from '../lib/online';
import { navigate } from '../lib/router';
import { getPrefs, setPrefs } from '../lib/storage';

// Grouping by access (a view preference, not a rule: the server already decided
// the role). Order: what the person manages, then collaborates on, then reads.
const GROUPS = [
  { key: 'manage', roles: ['owner', 'admin'] },
  { key: 'collaborate', roles: ['collaborator'] },
  { key: 'read', roles: ['reader'] },
] as const satisfies ReadonlyArray<{ key: string; roles: ReadonlyArray<KnowledgeBaseItem['role']> }>;

type Props = {
  /**
   * `screen` (default): the mobile screen, one at a time (`<main class="app-shell">`).
   * `sidebar`: the left column of the desktop shell (`<nav>`), with the open base highlighted.
   */
  variant?: 'screen' | 'sidebar';
  /** The base open in the right column (desktop); highlighted with `aria-current="page"`. */
  selectedId?: string;
};

export function KnowledgeBases({ variant = 'screen', selectedId }: Props) {
  const { t } = useLanguage();
  const { api, paths } = useChat();
  const [items, setItems] = React.useState<KnowledgeBaseItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [grouped, setGrouped] = React.useState(() => getPrefs().groupBy === 'access');
  const listRef = React.useRef<HTMLDivElement>(null);
  const sidebar = variant === 'sidebar';

  const toggleGrouped = () => {
    const next = !grouped;
    setGrouped(next);
    setPrefs({ groupBy: next ? 'access' : 'none' });
  };

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

  // Keyboard navigation in the list (desktop): arrows, Home and End move the focus
  // between bases; Enter/Space activate the focused button natively.
  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-kb]') ?? []);
    if (buttons.length === 0) return;
    const index = buttons.findIndex((b) => b === document.activeElement);
    let next = index;
    if (e.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1);
    if (e.key === 'ArrowUp') next = Math.max(0, index - 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length - 1;
    e.preventDefault();
    buttons[next]?.focus();
  };

  const renderItem = (kb: KnowledgeBaseItem) => {
    const selected = sidebar && kb.id === selectedId;
    return (
      <li key={kb.id}>
        <button
          type="button"
          data-kb={kb.id}
          aria-current={selected ? 'page' : undefined}
          className={`flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
            selected ? 'bg-muted border-l-2 border-primary pl-[14px]' : ''
          }`}
          onClick={() => {
            setPrefs({ lastKbId: kb.id });
            navigate(paths.conversation(kb.id));
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{kb.name}</span>
              {!grouped && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{t(`kb.role.${kb.role}`)}</span>
              )}
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
          {!sidebar && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </li>
    );
  };

  const Root: 'main' | 'nav' = sidebar ? 'nav' : 'main';
  return (
    <Root className={sidebar ? 'flex h-full min-h-0 flex-col' : 'app-shell'} aria-label={sidebar ? t('kb.title') : undefined}>
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1 py-1.5">
          <h1 className="text-balance break-words font-display text-xl font-semibold leading-tight">{t('kb.title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('kb.subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton label={grouped ? t('kb.ungroup') : t('kb.group')} onClick={toggleGrouped} aria-pressed={grouped}>
            <Layers strokeWidth={1.75} />
          </IconButton>
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
        {sidebar && (
          <div className="px-4 pt-3 empty:hidden">
            <InstallButton full />
          </div>
        )}
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
          <div ref={listRef} onKeyDown={onListKeyDown}>
            {grouped ? (
              GROUPS.map((g) => {
                const members = items.filter((kb) => (g.roles as ReadonlyArray<string>).includes(kb.role));
                if (members.length === 0) return null;
                const headingId = `kb-group-${g.key}`;
                return (
                  <section key={g.key} aria-labelledby={headingId} data-testid={headingId}>
                    <h2 id={headingId} className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-background/95 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                      <span>{t(`kb.groups.${g.key}`)}</span>
                      <span className="tabular-nums">{members.length}</span>
                    </h2>
                    <ul className="divide-y divide-border">{members.map(renderItem)}</ul>
                  </section>
                );
              })
            ) : (
              <ul className="divide-y divide-border">{items.map(renderItem)}</ul>
            )}
          </div>
        )}
      </div>
    </Root>
  );
}

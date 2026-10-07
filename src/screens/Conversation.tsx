import * as React from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Composer } from '@/components/Composer';
import { ConfirmCard } from '@/components/ConfirmCard';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { TurnList, type LiveState } from '@/components/TurnList';
import { hasKey } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';
import { api, ApiError, readNdjson, type Activity, type AgentEvent, type Pending, type Turn } from '@/lib/api';
import { reportNetworkFailure, reportNetworkSuccess } from '@/lib/online';
import { navigate, paths } from '@/lib/router';
import { SourceSheet } from './SourceSheet';

type Props = { kbId: string; docId?: string; kbName?: string };

const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Same state machine as web's useKbAgent, without Next: one run at a time per
// screen (ref guard), AbortController to stop, no automatic reconnection.
export function Conversation({ kbId, docId, kbName }: Props) {
  const { t, language } = useLanguage();
  const { push } = useToast();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [live, setLive] = React.useState<LiveState | null>(null);
  const [running, setRunning] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<{ text: string; nonce: number } | null>(null);
  const [resolvedName, setResolvedName] = React.useState<string | undefined>(kbName);
  React.useEffect(() => {
    if (kbName) return;
    let cancelled = false;
    api
      .knowledgeBases()
      .then(({ items }) => {
        if (!cancelled) setResolvedName(items.find((k) => k.id === kbId)?.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kbId, kbName]);
  const runGuard = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const errorText = React.useCallback(
    (code: string) => {
      const key = `conversation.errors.${code}`;
      return hasKey(language, key) || hasKey('en', key) ? t(key) : t('conversation.errors.unknown');
    },
    [language, t],
  );

  const load = React.useCallback(async () => {
    try {
      const s = await api.session(kbId);
      reportNetworkSuccess();
      setTurns(s.turns);
      setPending(s.pending);
      setRunning(s.isRunning);
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network') reportNetworkFailure();
      if (e instanceof ApiError && e.status === 403) {
        push({ message: errorText('forbidden'), kind: 'error' });
        navigate(paths.kbs(), { replace: true });
        return;
      }
      if (!(e instanceof ApiError && e.status === 401)) setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, [kbId, push, errorText]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const scrollToEnd = React.useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  React.useEffect(scrollToEnd, [turns.length, live?.text, pending, scrollToEnd]);

  const run = React.useCallback(
    async (body: { query: string } | { resume: { pendingId: string; approved: boolean } }) => {
      if (runGuard.current) return;
      runGuard.current = true;
      setRunning(true);
      setNotice(null);
      const controller = new AbortController();
      abortRef.current = controller;
      const userTurnId = uid();
      if ('query' in body) {
        setTurns((ts) => [...ts, { id: userTurnId, role: 'user', content: body.query }]);
      } else {
        setPending(null);
      }
      const state: LiveState = { text: '', activity: [], thinking: true };
      setLive({ ...state });
      let sawDone = false;
      try {
        const res = await api.agent(kbId, body, controller.signal);
        reportNetworkSuccess();
        for await (const ev of readNdjson<AgentEvent>(res)) {
          switch (ev.status) {
            case 'Thinking':
              state.thinking = true;
              break;
            case 'Tool':
              if (ev.activity) state.activity = [...state.activity, ev.activity as Activity];
              // Text written before a tool step and after it are separate paragraphs.
              if (state.text && !/\n\s*$/.test(state.text)) state.text += '\n\n';
              break;
            case 'Streaming':
              if (ev.analysisChunk) state.text += ev.analysisChunk;
              break;
            case 'Confirm':
              if (ev.pending) setPending(ev.pending);
              break;
            case 'Truncated':
              setNotice(t('conversation.truncated'));
              break;
            case 'Notice':
              if (ev.noticeKey) {
                const leaf = ev.noticeKey.split('.').pop() ?? '';
                const key = `conversation.${leaf}`;
                setNotice(hasKey(language, key) || hasKey('en', key) ? t(key) : null);
              }
              break;
            case 'Error':
              push({ message: errorText(ev.error?.code ?? 'unknown'), kind: 'error', duration: 8000 });
              break;
            case 'Applied':
            case 'Done':
              sawDone = true;
              break;
          }
          setLive({ ...state });
        }
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === 'aborted') {
            /* stopped by the person */
          } else if (e.code === 'network') {
            reportNetworkFailure();
            push({ message: errorText('network'), kind: 'error' });
          } else if (e.status === 409 || e.status === 403 || e.status === 400) {
            // A 409 means the user turn never reached the server: drop the optimistic copy.
            if ('query' in body) setTurns((ts) => ts.filter((x) => x.id !== userTurnId));
            setNotice(errorText(e.code));
          } else if (e.status !== 401) {
            push({ message: errorText('sendFailed'), kind: 'error' });
          }
        }
      } finally {
        if (state.text || state.activity.length) {
          setTurns((ts) => [...ts, { id: uid(), role: 'agent', content: state.text, activity: state.activity }]);
        }
        setLive(null);
        setRunning(false);
        abortRef.current = null;
        runGuard.current = false;
        // Reconcile with the server's truth (ids, pending, persisted turns).
        if (sawDone || !controller.signal.aborted) void load();
      }
    },
    [kbId, t, language, push, errorText, load],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = React.useCallback(async () => {
    try {
      await api.clearSession(kbId);
      setTurns([]);
      setPending(null);
      setNotice(null);
      setClearOpen(false);
    } catch (e) {
      setClearOpen(false);
      if (e instanceof ApiError && e.status === 409) push({ message: errorText('clearFailed'), kind: 'error' });
      else if (!(e instanceof ApiError && e.status === 401)) push({ message: errorText('unknown'), kind: 'error' });
    }
  }, [kbId, push, errorText]);

  const hrefFor = React.useCallback((id: string) => paths.document(kbId, id), [kbId]);
  const openDoc = React.useCallback((href: string) => navigate(href), []);

  return (
    <main className="app-shell">
      <header className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <IconButton label={t('app.back')} onClick={() => navigate(paths.kbs())}>
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{resolvedName ?? t('kb.title')}</h1>
        <IconButton label={t('conversation.clear')} onClick={() => setClearOpen(true)} disabled={running || turns.length === 0}>
          <Trash2 className="h-5 w-5" strokeWidth={1.75} />
        </IconButton>
      </header>
      <OfflineBanner onRetry={() => void load()} />
      <div className="scroll-area" ref={listRef}>
        {!loaded && (
          <p role="status" className="px-4 py-8 text-center text-mutedForeground">
            {t('app.loading')}
          </p>
        )}
        {loaded && loadError && (
          <div className="px-4 py-8 text-center">
            <p role="alert" className="text-destructive">
              {t('conversation.loadFailed')}
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => void load()}>
              {t('app.retry')}
            </Button>
          </div>
        )}
        {loaded && !loadError && turns.length === 0 && !live && !pending && (
          <p className="px-6 py-10 text-center text-sm text-mutedForeground">{t('conversation.empty')}</p>
        )}
        {loaded && !loadError && (
          <TurnList turns={turns} live={live} hrefFor={hrefFor} onOpenDoc={openDoc} onPickFollowup={(q) => setPrefill({ text: q, nonce: Date.now() })}>
            {pending && !running && (
              <ConfirmCard pending={pending} onResolve={(approved) => run({ resume: { pendingId: pending.id, approved } })} />
            )}
            {notice && (
              <p role="status" data-testid="notice" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {notice}
              </p>
            )}
          </TurnList>
        )}
      </div>
      <Composer
        onSend={(q) => void run({ query: q })}
        onStop={stop}
        running={running}
        disabled={!loaded || loadError || !!pending}
        hint={t('conversation.hint')}
        prefill={prefill}
      />
      <Sheet open={clearOpen} onOpenChange={setClearOpen} heading={t('conversation.clearConfirm.title')} description={t('conversation.clearConfirm.body')}>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="secondary" onClick={() => setClearOpen(false)}>
            {t('app.cancel')}
          </Button>
          <Button variant="destructive" onClick={() => void clear()} data-testid="clear-confirm">
            {t('conversation.clearConfirm.confirm')}
          </Button>
        </div>
      </Sheet>
      <SourceSheet kbId={kbId} docId={docId ?? null} onClose={() => navigate(paths.conversation(kbId), { replace: true })} />
    </main>
  );
}

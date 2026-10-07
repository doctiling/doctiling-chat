import * as React from 'react';
import { ArrowLeft, Files, Trash2 } from 'lucide-react';
import { Badge } from '@doctiling/ui/atoms/badge';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { Composer } from '../components/Composer';
import { ConfirmCard } from '../components/ConfirmCard';
import { IconButton } from '../components/IconButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { TurnList, type LiveState } from '../components/TurnList';
import { hasKey } from '../i18n';
import { useLanguage } from '../i18n/use-language';
import { ApiError, readNdjson, type Activity, type AgentBody, type AgentEvent, type Pending, type SessionAccess, type Turn, type TurnReference } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { useDocuments } from '../lib/documents';
import { useIsDesktop } from '../lib/media';
import { reportNetworkFailure, reportNetworkSuccess } from '../lib/online';
import { navigate } from '../lib/router';
import { Documents } from './Documents';
import { SourceSheet } from './SourceSheet';

type Props = {
  kbId: string;
  docId?: string;
  kbName?: string;
  /** Desktop: the documents list is open in the side panel (route /kb/:id/docs); the header toggle flips it. */
  docsOpen?: boolean;
};

const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Same state machine as web's useKbAgent, without Next: one run at a time per
// screen (ref guard), AbortController to stop, no automatic reconnection.
export function Conversation({ kbId, docId, kbName, docsOpen = false }: Props) {
  const { t, language } = useLanguage();
  const { api, paths } = useChat();
  const { push } = useToast();
  const desktop = useIsDesktop();
  const { items: documents } = useDocuments(api, kbId);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [access, setAccess] = React.useState<SessionAccess | null>(null);
  // The server persists `content` only; the tags of a question keep showing after the
  // reload that follows a run by remembering them per question text (last one wins).
  const referencesByQuery = React.useRef(new Map<string, TurnReference[]>());
  const withReferences = React.useCallback((ts: Turn[]): Turn[] => {
    const map = referencesByQuery.current;
    if (map.size === 0) return ts;
    return ts.map((x) => (x.role === 'user' && !x.references && map.has(x.content) ? { ...x, references: map.get(x.content) } : x));
  }, []);
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
  }, [api, kbId, kbName]);
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

  const silent = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.code === 'chat_disabled');

  const load = React.useCallback(async () => {
    try {
      const s = await api.session(kbId);
      reportNetworkSuccess();
      setTurns(withReferences(s.turns));
      setPending(s.pending);
      setRunning(s.isRunning);
      setAccess(s.access ?? null);
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network') reportNetworkFailure();
      if (e instanceof ApiError && e.status === 403) {
        push({ message: errorText('forbidden'), kind: 'error' });
        navigate(paths.kbs(), { replace: true });
        return;
      }
      if (!silent(e)) setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, [api, kbId, paths, push, errorText, withReferences]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const scrollToEnd = React.useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  React.useEffect(scrollToEnd, [turns.length, live?.text, pending, scrollToEnd]);

  const run = React.useCallback(
    async (body: AgentBody) => {
      if (runGuard.current) return;
      runGuard.current = true;
      setRunning(true);
      setNotice(null);
      const controller = new AbortController();
      abortRef.current = controller;
      const userTurnId = uid();
      if ('query' in body) {
        const ids = body.referencedDocumentIds ?? [];
        const references = ids
          .map((id) => documents?.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => !!d)
          .map((d) => ({ id: d.id, title: d.title }));
        if (references.length) referencesByQuery.current.set(body.query, references);
        setTurns((ts) => [...ts, { id: userTurnId, role: 'user', content: body.query, references: references.length ? references : undefined }]);
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
          } else if (!silent(e)) {
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
    [api, kbId, t, language, push, errorText, load, documents],
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
      else if (!silent(e)) push({ message: errorText('unknown'), kind: 'error' });
    }
  }, [api, kbId, push, errorText]);

  const hrefFor = React.useCallback((id: string) => paths.document(kbId, id), [paths, kbId]);
  const openDoc = React.useCallback((href: string) => navigate(href), []);
  const readOnly = access?.canWrite === false;
  // Mobile: the icon opens the Documents screen. Desktop: it toggles the list in the side panel.
  const toggleDocs = () => navigate(docsOpen ? paths.conversation(kbId) : paths.documents(kbId));

  // One column on a phone. From md the conversation column (header, turns,
  // composer) sits next to the source panel when a document is open; the
  // content is centred at ~760 px so long answers stay readable on wide screens.
  return (
    <main className="app-shell">
      <div className="flex min-h-0 flex-1 flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-1 border-b border-border px-2 py-1.5 md:px-4">
        <IconButton label={t('app.back')} onClick={() => navigate(paths.kbs())} className="md:hidden">
          <ArrowLeft strokeWidth={1.75} />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{resolvedName ?? t('kb.title')}</h1>
        {readOnly && (
          <SimpleTooltip label={t('conversation.readOnly')} side="bottom">
            <Badge variant="secondary" tabIndex={0} data-testid="read-only-badge" className="shrink-0 cursor-default font-medium">
              {t('conversation.readOnlyBadge')}
            </Badge>
          </SimpleTooltip>
        )}
        <IconButton label={docsOpen ? t('documents.close') : t('documents.title')} onClick={toggleDocs} aria-pressed={desktop ? docsOpen : undefined}>
          <Files strokeWidth={1.75} />
        </IconButton>
        <IconButton label={t('conversation.clear')} onClick={() => setClearOpen(true)} disabled={running || turns.length === 0}>
          <Trash2 strokeWidth={1.75} />
        </IconButton>
      </header>
      <OfflineBanner onRetry={() => void load()} />
      <div className="scroll-area" ref={listRef}>
        <div className="mx-auto w-full md:max-w-[760px]">
        {!loaded && (
          <p role="status" className="px-4 py-8 text-center text-muted-foreground">
            {t('app.loading')}
          </p>
        )}
        {loaded && loadError && (
          <div className="px-4 py-8 text-center">
            <p role="alert" className="text-destructive">
              {t('conversation.loadFailed')}
            </p>
            <Button variant="outline" size="lg" className="mt-3" onClick={() => void load()}>
              {t('app.retry')}
            </Button>
          </div>
        )}
        {loaded && !loadError && turns.length === 0 && !live && !pending && (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">{t('conversation.empty')}</p>
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
      </div>
      <Composer
        onSend={(q, ids) => void run(ids.length ? { query: q, referencedDocumentIds: ids } : { query: q })}
        onStop={stop}
        running={running}
        disabled={!loaded || loadError || !!pending}
        hint={`${t('conversation.hint')} ${t('conversation.mentionHint')}`}
        placeholder={readOnly ? t('conversation.placeholderReadOnly') : undefined}
        prefill={prefill}
        documents={documents}
      />
      <Sheet open={clearOpen} onOpenChange={setClearOpen} heading={t('conversation.clearConfirm.title')} description={t('conversation.clearConfirm.body')}>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" size="lg" className="px-4" onClick={() => setClearOpen(false)}>
            {t('app.cancel')}
          </Button>
          <Button variant="destructive" size="lg" className="px-4" onClick={() => void clear()} data-testid="clear-confirm">
            {t('conversation.clearConfirm.confirm')}
          </Button>
        </div>
      </Sheet>
      </div>
      {desktop && docsOpen && !docId ? (
        <Documents kbId={kbId} variant="panel" onClose={() => navigate(paths.conversation(kbId))} />
      ) : (
        <SourceSheet kbId={kbId} docId={docId ?? null} onClose={() => navigate(paths.conversation(kbId), { replace: true })} />
      )}
      </div>
    </main>
  );
}

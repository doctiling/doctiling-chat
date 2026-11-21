import * as React from 'react';
import { ActivityLine } from './ActivityLine';
import { ListenControls } from './ListenControls';
import { Markdown } from './Markdown';
import { useLanguage } from '../i18n/use-language';
import { groupDocumentReads } from '../lib/activity';
import type { Activity, ActivitySource, Turn } from '../lib/api';
import { citedDocumentIds, linkifyDocCitations } from '../lib/citations';
import { splitFollowups } from '../lib/followups';
import { speakableText } from '../lib/speakable';
import { useSpeech } from '../lib/speech';
import { getPrefs } from '../lib/storage';

export type LiveState = {
  /** text streamed so far for the agent turn in progress */
  text: string;
  activity: Activity[];
  thinking: boolean;
};

type Props = {
  turns: Turn[];
  live: LiveState | null;
  hrefFor: (docId: string) => string;
  onOpenDoc: (href: string) => void;
  children?: React.ReactNode;
  /** Follow-up chips on the last agent turn fill the composer. */
  onPickFollowup?: (q: string) => void;
};

/** The documents a turn read, once each, in the order read. */
export function turnSources(activity: Activity[] | undefined): ActivitySource[] {
  const byId = new Map<string, ActivitySource>();
  for (const step of activity ?? []) for (const src of step.sources ?? []) if (!byId.has(src.id)) byId.set(src.id, src);
  return [...byId.values()];
}

/** doctiling-web spec 082 US5 (FR-014): what the answer cites, and the rest it only read. No citation → all are sources. */
export function splitSources(text: string, sources: ActivitySource[]): { cited: ActivitySource[]; consulted: ActivitySource[] } {
  const ids = new Set(citedDocumentIds(text));
  const cited = sources.filter((s) => ids.has(s.id));
  if (cited.length === 0) return { cited: sources, consulted: [] };
  return { cited, consulted: sources.filter((s) => !ids.has(s.id)) };
}

function SourceChip({ src, hrefFor, onOpenDoc }: { src: ActivitySource; hrefFor: Props['hrefFor']; onOpenDoc: Props['onOpenDoc'] }) {
  return (
    <button
      type="button"
      onClick={() => onOpenDoc(hrefFor(src.id))}
      className="max-w-[16rem] truncate rounded-full border border-border bg-background px-3 py-1 text-[12px] text-foreground"
    >
      {src.title}
    </button>
  );
}

function Bubble({ turn, hrefFor, onOpenDoc, onPickFollowup }: { turn: Turn; hrefFor: Props['hrefFor']; onOpenDoc: Props['onOpenDoc']; onPickFollowup?: (q: string) => void }) {
  const { t } = useLanguage();
  const isUser = turn.role === 'user';
  const split = React.useMemo(() => (isUser ? { text: turn.content, followups: [] } : splitFollowups(turn.content)), [isUser, turn.content]);
  const sources = React.useMemo(() => (isUser ? [] : turnSources(turn.activity)), [isUser, turn.activity]);
  const rendered = React.useMemo(() => {
    if (isUser) return split.text;
    const titles = new Map(sources.map((s) => [s.id, s.title]));
    return linkifyDocCitations(split.text, hrefFor, {
      titleFor: (id) => titles.get(id),
      fallbackLabel: t('conversation.documentLink'),
      blockLabel: (n) => t('conversation.blockLink', { n }),
    });
  }, [isUser, split.text, hrefFor, t, sources]);
  const shown = React.useMemo(() => splitSources(split.text, sources), [split.text, sources]);
  const speakable = React.useMemo(() => (isUser ? '' : speakableText(split.text)), [isUser, split.text]);
  const steps = React.useMemo(() => (isUser ? [] : groupDocumentReads(turn.activity ?? [])), [isUser, turn.activity]);
  return (
    <article className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`} data-testid="turn" data-role={turn.role}>
      <span className="px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t(isUser ? 'conversation.you' : 'conversation.agent')}
      </span>
      {!isUser && steps.length > 0 && (
        // 2026-11-20: like the studio chat, a finished turn folds its steps; the answer reads first.
        <details className="px-1 text-[12px] text-muted-foreground" data-testid="turn-activity">
          <summary className="min-h-[32px] cursor-pointer select-none py-1">{t('conversation.steps', { count: steps.length })}</summary>
          <div className="flex flex-col gap-0.5">
            {steps.map(({ activity: a }, i) => (
              <ActivityLine key={i} activity={a} />
            ))}
          </div>
        </details>
      )}
      {isUser ? (
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base leading-relaxed text-primary-foreground">
          {turn.content}
        </div>
      ) : (
        <div className="w-full max-w-full rounded-2xl rounded-bl-md bg-card px-4 py-3 text-card-foreground">
          <Markdown markdown={rendered} onInternalLink={onOpenDoc} />
        </div>
      )}
      {!isUser && turn.interrupted && (
        <p role="status" className="px-1 text-xs text-destructive">
          {t('conversation.interrupted')}
        </p>
      )}
      {!isUser && shown.cited.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5 px-1" data-testid="turn-sources">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t('conversation.sources')}</span>
          {shown.cited.map((src) => (
            <SourceChip key={src.id} src={src} hrefFor={hrefFor} onOpenDoc={onOpenDoc} />
          ))}
          {shown.consulted.length > 0 && (
            <details className="w-full text-[12px] text-muted-foreground" data-testid="turn-consulted">
              <summary className="min-h-[32px] cursor-pointer select-none py-1">{t('conversation.consulted', { count: shown.consulted.length })}</summary>
              <div className="flex flex-wrap gap-1.5">
                {shown.consulted.map((src) => (
                  <SourceChip key={src.id} src={src} hrefFor={hrefFor} onOpenDoc={onOpenDoc} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {!isUser && <ListenControls id={turn.id} text={speakable} />}
      {isUser && turn.references && turn.references.length > 0 && (
        <ul className="flex max-w-[85%] flex-wrap justify-end gap-1 px-1" data-testid="turn-refs" aria-label={t('mentions.references')}>
          {turn.references.map((r) => (
            <li key={r.id} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
              @{r.title}
            </li>
          ))}
        </ul>
      )}
      {!isUser && onPickFollowup && split.followups.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pt-1" data-testid="followups">
          {split.followups.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPickFollowup(q)}
              className="min-h-[44px] rounded-full border border-border bg-background px-4 py-2 text-left text-sm text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

// Voice mode: a reply that arrives while the person is here is read aloud. The replies already on
// screen when the list first shows (the history) are never read.
function useReadNewReplies(turns: Turn[]) {
  const speech = useSpeech();
  const lastAgent = [...turns].reverse().find((x) => x.role === 'agent');
  const seenRef = React.useRef<string | undefined>(lastAgent?.id);
  React.useEffect(() => {
    if (!lastAgent || lastAgent.id === seenRef.current) return;
    seenRef.current = lastAgent.id;
    if (!getPrefs().voiceReplies) return;
    const text = speakableText(splitFollowups(lastAgent.content).text);
    if (text) speech.toggle(lastAgent.id, text);
  }, [lastAgent, speech]);
}

export function TurnList({ turns, live, hrefFor, onOpenDoc, children, onPickFollowup }: Props) {
  const { t } = useLanguage();
  useReadNewReplies(turns);
  const liveRendered = React.useMemo(
    () =>
      live
        ? linkifyDocCitations(splitFollowups(live.text).text, hrefFor, {
            fallbackLabel: t('conversation.documentLink'),
            blockLabel: (n) => t('conversation.blockLink', { n }),
          })
        : '',
    [live, hrefFor, t],
  );
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {turns.map((turn, i) => (
        <Bubble key={turn.id} turn={turn} hrefFor={hrefFor} onOpenDoc={onOpenDoc} onPickFollowup={!live && i === turns.length - 1 ? onPickFollowup : undefined} />
      ))}
      {live && (
        <article className="flex flex-col items-start gap-1" data-testid="turn-live" data-role="agent">
          <span className="px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t('conversation.agent')}</span>
          <div className="flex flex-col gap-0.5 px-1">
            {groupDocumentReads(live.activity).map(({ activity: a, last }, i) => (
              <ActivityLine key={i} activity={a} live={last === live.activity.length - 1 && !live.text} />
            ))}
            {live.thinking && live.activity.length === 0 && !live.text && (
              <ActivityLine activity={{ toolName: '', labelKey: 'conversation.thinking' }} live />
            )}
          </div>
          {live.text && (
            <div className="w-full rounded-2xl rounded-bl-md bg-card px-4 py-3 text-card-foreground">
              <Markdown markdown={liveRendered} onInternalLink={onOpenDoc} />
            </div>
          )}
        </article>
      )}
      {children}
    </div>
  );
}

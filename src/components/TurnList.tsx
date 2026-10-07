import * as React from 'react';
import { ActivityLine } from './ActivityLine';
import { Markdown } from './Markdown';
import { useLanguage } from '../i18n/use-language';
import type { Activity, Turn } from '../lib/api';
import { linkifyDocCitations } from '../lib/citations';
import { splitFollowups } from '../lib/followups';

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

function Bubble({ turn, hrefFor, onOpenDoc, onPickFollowup }: { turn: Turn; hrefFor: Props['hrefFor']; onOpenDoc: Props['onOpenDoc']; onPickFollowup?: (q: string) => void }) {
  const { t } = useLanguage();
  const isUser = turn.role === 'user';
  const split = React.useMemo(() => (isUser ? { text: turn.content, followups: [] } : splitFollowups(turn.content)), [isUser, turn.content]);
  const rendered = React.useMemo(() => (isUser ? split.text : linkifyDocCitations(split.text, hrefFor)), [isUser, split.text, hrefFor]);
  return (
    <article className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`} data-testid="turn" data-role={turn.role}>
      <span className="px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t(isUser ? 'conversation.you' : 'conversation.agent')}
      </span>
      {!isUser && turn.activity && turn.activity.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1">
          {turn.activity.map((a, i) => (
            <ActivityLine key={i} activity={a} />
          ))}
        </div>
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

export function TurnList({ turns, live, hrefFor, onOpenDoc, children, onPickFollowup }: Props) {
  const { t } = useLanguage();
  const liveRendered = React.useMemo(() => (live ? linkifyDocCitations(splitFollowups(live.text).text, hrefFor) : ''), [live, hrefFor]);
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {turns.map((turn, i) => (
        <Bubble key={turn.id} turn={turn} hrefFor={hrefFor} onOpenDoc={onOpenDoc} onPickFollowup={!live && i === turns.length - 1 ? onPickFollowup : undefined} />
      ))}
      {live && (
        <article className="flex flex-col items-start gap-1" data-testid="turn-live" data-role="agent">
          <span className="px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t('conversation.agent')}</span>
          <div className="flex flex-col gap-0.5 px-1">
            {live.activity.map((a, i) => (
              <ActivityLine key={i} activity={a} live={i === live.activity.length - 1 && !live.text} />
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

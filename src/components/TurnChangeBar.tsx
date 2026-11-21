import * as React from 'react';
import { Check, Undo2 } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { useLanguage } from '../i18n/use-language';
import type { TurnChange } from '../lib/api';

type Props = {
  change: TurnChange;
  /** Resolves after the server answered; the caller reloads the session and says how it went. */
  onDecide: (action: 'keep' | 'undo') => Promise<unknown>;
  /** Opens a changed document in the side panel. */
  onOpenDocument?: (docId: string) => void;
  disabled?: boolean;
};

/**
 * doctiling-web spec 086 extension: the pointer's «Mantener / Deshacer», without the pointer.
 * Under an agent answer that wrote something: which documents changed, and one decision for all.
 * Once decided, only the outcome stays.
 */
export function TurnChangeBar({ change, onDecide, onOpenDocument, disabled = false }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = React.useState<null | 'keep' | 'undo'>(null);
  const decide = async (action: 'keep' | 'undo') => {
    if (busy) return;
    setBusy(action);
    try {
      await onDecide(action);
    } finally {
      setBusy(null);
    }
  };
  const docs = change.documents;
  if (change.state !== 'open') {
    return (
      <p role="status" data-testid="turn-change-outcome" className="px-1 text-xs text-muted-foreground">
        {t(change.state === 'undone' ? 'conversation.changes.undone' : 'conversation.changes.kept')}
      </p>
    );
  }
  return (
    <section
      data-testid="turn-change-bar"
      aria-label={t('conversation.changes.summary', { docs: docs.map((d) => `«${d.title}»`).join(', ') })}
      className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm"
    >
      <span className="min-w-0 flex-1 text-muted-foreground">
        {t('conversation.changes.lead')}{' '}
        {docs.map((d, i) => (
          <React.Fragment key={d.id}>
            {i > 0 && ', '}
            {onOpenDocument ? (
              <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => onOpenDocument(d.id)}>
                «{d.title}»
              </button>
            ) : (
              <span className="font-medium text-foreground">«{d.title}»</span>
            )}
          </React.Fragment>
        ))}
      </span>
      <div className="flex shrink-0 gap-2">
        <SimpleTooltip label={t('conversation.changes.undoHint')}>
          <Button
            variant="outline"
            size="sm"
            data-testid="turn-change-undo"
            disabled={disabled || busy !== null}
            aria-busy={busy === 'undo' || undefined}
            onClick={() => void decide('undo')}
          >
            <Undo2 className="mr-1 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {t('conversation.changes.undo')}
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label={t('conversation.changes.keepHint')}>
          <Button
            size="sm"
            data-testid="turn-change-keep"
            disabled={disabled || busy !== null}
            aria-busy={busy === 'keep' || undefined}
            onClick={() => void decide('keep')}
          >
            <Check className="mr-1 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {t('conversation.changes.keep')}
          </Button>
        </SimpleTooltip>
      </div>
    </section>
  );
}

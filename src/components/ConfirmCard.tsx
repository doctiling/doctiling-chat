import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { hasKey } from '../i18n';
import { useLanguage } from '../i18n/use-language';
import type { Pending } from '../lib/api';

type Props = {
  pending: Pending;
  onResolve: (approved: boolean) => Promise<unknown>;
  disabled?: boolean;
};

export function summaryKeyFor(pending: Pending, language: 'en' | 'es'): string {
  const leaf = pending.summaryKey.split('.').pop() ?? pending.toolName;
  const key = `conversation.confirm.summary.${leaf}`;
  return hasKey(language, key) || hasKey('en', key) ? key : 'conversation.confirm.summary.generic';
}

/** FR-010: destructive actions wait for an explicit decision; one tap, one resume. */
export function ConfirmCard({ pending, onResolve, disabled = false }: Props) {
  const { t, language } = useLanguage();
  const busy = React.useRef(false);
  const [pendingChoice, setPendingChoice] = React.useState<null | 'approve' | 'reject'>(null);
  const resolve = async (approved: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setPendingChoice(approved ? 'approve' : 'reject');
    try {
      await onResolve(approved);
    } finally {
      busy.current = false;
      setPendingChoice(null);
    }
  };
  const values = { name: pending.summaryValues?.name ?? pending.summaryValues?.title ?? '', ...pending.summaryValues };
  return (
    <section
      data-testid="confirm-card"
      className="rounded-xl border border-destructive/40 bg-card p-4 text-card-foreground shadow-sm"
      aria-labelledby={`confirm-${pending.id}`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id={`confirm-${pending.id}`} className="font-medium">
            {t('conversation.confirm.title')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t(summaryKeyFor(pending, language), values)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SimpleTooltip label={t('conversation.confirm.rejectHint')}>
          <Button
            variant="outline"
            size="lg"
            className="w-full px-4"
            disabled={disabled || pendingChoice !== null}
            aria-busy={pendingChoice === 'reject' || undefined}
            onClick={() => void resolve(false)}
          >
            {t('conversation.confirm.reject')}
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label={t('conversation.confirm.approveHint')}>
          <Button
            variant="destructive"
            size="lg"
            className="w-full px-4"
            disabled={disabled || pendingChoice !== null}
            aria-busy={pendingChoice === 'approve' || undefined}
            onClick={() => void resolve(true)}
          >
            {t('conversation.confirm.approve')}
          </Button>
        </SimpleTooltip>
      </div>
    </section>
  );
}

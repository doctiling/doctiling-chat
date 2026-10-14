import * as React from 'react';
import { Button } from '@doctiling/ui/atoms/button';
import { useLanguage } from '../i18n/use-language';
import type { DocumentListItem } from '../lib/api';
import { useChat } from '../lib/chat-context';

type Props = {
  kbId: string;
  documents: DocumentListItem[];
  /** Files of the same operation that did not become documents, already worded. */
  problems?: string[];
  /** Called after "Later", or after "Done" once indexing finished. */
  onClose: () => void;
  /** Called when indexing ran, so the list can refresh its "not indexed" marks. */
  onIndexed?: () => void;
};

// spec 054 FR-005/FR-006: one question per operation. "Index now" indexes every document the operation created;
// "Later" leaves them in the base unindexed.
export function IndexPrompt({ kbId, documents, problems = [], onClose, onIndexed }: Props) {
  const { t } = useLanguage();
  const { api } = useChat();
  const [state, setState] = React.useState<'ask' | 'running' | 'done'>('ask');
  const [outcome, setOutcome] = React.useState('');
  const busy = React.useRef(false);

  const indexNow = async () => {
    if (busy.current) return;
    busy.current = true;
    setState('running');
    try {
      const results = await api.indexDocuments(
        kbId,
        documents.map((d) => d.id),
      );
      const ok = results.filter((r) => r.ok).length;
      setOutcome(ok === results.length ? t('indexPrompt.done') : ok === 0 ? t('indexPrompt.failed') : t('indexPrompt.partial', { ok, total: results.length }));
    } catch {
      setOutcome(t('indexPrompt.failed'));
    } finally {
      setState('done');
      onIndexed?.();
    }
  };

  const first = documents[0];
  return (
    <div data-testid="index-prompt" className="space-y-3">
      <h3 className="font-display text-base font-semibold">{t('indexPrompt.heading')}</h3>
      <p className="text-sm text-muted-foreground">
        {documents.length === 1 && first ? t('indexPrompt.bodyOne', { title: first.title }) : t('indexPrompt.bodyMany', { count: documents.length })}
      </p>
      {problems.length > 0 && (
        <ul className="space-y-1 text-sm text-destructive" data-testid="index-prompt-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {state === 'done' ? (
        <>
          <p role="status" className="text-sm">
            {outcome}
          </p>
          <Button size="lg" className="w-full" onClick={onClose}>
            {t('newDocument.created.done')}
          </Button>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" disabled={state === 'running'} onClick={onClose}>
            {t('indexPrompt.later')}
          </Button>
          <Button size="lg" disabled={state === 'running'} onClick={() => void indexNow()}>
            {state === 'running' ? t('indexPrompt.indexing') : t('indexPrompt.now')}
          </Button>
        </div>
      )}
    </div>
  );
}

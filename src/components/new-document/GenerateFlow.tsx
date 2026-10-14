import * as React from 'react';
import { Button } from '@doctiling/ui/atoms/button';
import { Textarea } from '@doctiling/ui/atoms/textarea';
import { useLanguage } from '../../i18n/use-language';
import { readNdjson, type DocumentListItem, type GenerateEvent } from '../../lib/api';
import { useChat } from '../../lib/chat-context';
import { errorCode, errorKey } from '../../lib/new-document';

type Props = { kbId: string; onDone: (doc: DocumentListItem) => void };

// spec 054 FR-004: the studio's AI drafting. The server writes and saves (unindexed); the chat shows the progress and
// hands the saved document to the index question. Quota and credit errors come back as the stream's Error code.
export function GenerateFlow({ kbId, onDone }: Props) {
  const { t, language } = useLanguage();
  const { api } = useChat();
  const [topic, setTopic] = React.useState('');
  const [deep, setDeep] = React.useState(false);
  const [phase, setPhase] = React.useState<'idle' | 'thinking' | 'drafting'>('idle');
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const abort = React.useRef<AbortController | null>(null);
  const id = React.useId();
  React.useEffect(() => () => abort.current?.abort(), []);

  const generate = async () => {
    const value = topic.trim();
    if (!value || abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setDraft('');
    setPhase('thinking');
    let saved: DocumentListItem | null = null;
    try {
      const res = await api.generateDocument(kbId, { topic: value, ...(deep ? { deepReasoning: true } : {}), locale: language }, controller.signal);
      for await (const ev of readNdjson<GenerateEvent>(res)) {
        if (ev.status === 'Thinking') setPhase('thinking');
        else if (ev.status === 'Drafting') {
          setPhase('drafting');
          setDraft((d) => d + (ev.analysisChunk ?? ''));
        } else if (ev.status === 'Saved') saved = ev.document;
        else if (ev.status === 'Error') setError(ev.code);
      }
      if (!saved && !controller.signal.aborted) setError((e) => e ?? 'unknown');
    } catch (e) {
      const code = errorCode(e);
      if (code !== 'aborted') setError(code);
    } finally {
      abort.current = null;
      setPhase('idle');
    }
    if (saved) onDone(saved);
  };

  const running = phase !== 'idle';
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">{t('newDocument.generate.topicLabel')}</label>
        <Textarea
          id={id}
          value={topic}
          maxLength={2000}
          rows={3}
          disabled={running}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('newDocument.generate.topicPlaceholder')}
          className="text-base md:text-base"
        />
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={deep} disabled={running} onChange={(e) => setDeep(e.target.checked)} />
        {t('newDocument.generate.deep')}
      </label>
      {running && (
        <div className="space-y-1" data-testid="generate-progress">
          <p role="status" className="text-sm text-muted-foreground">
            {phase === 'thinking' ? t('newDocument.generate.thinking') : t('newDocument.generate.drafting')}
          </p>
          {draft && <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{draft}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey(error))}
        </p>
      )}
      {running ? (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => abort.current?.abort()}>
          {t('newDocument.generate.stop')}
        </Button>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={!topic.trim()}>
          {t('newDocument.generate.submit')}
        </Button>
      )}
    </form>
  );
}

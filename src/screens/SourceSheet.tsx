import * as React from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { Markdown } from '../components/Markdown';
import { Sheet } from '../components/Sheet';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type DocumentView } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { useIsDesktop } from '../lib/media';

type Props = { kbId: string; docId: string | null; onClose: () => void };

// FR-016: the cited source in reading mode, inside the app. 403 → permission
// notice (the document may be private to someone else). On a phone it is a
// bottom sheet (dialog); from md it is a side panel next to the conversation
// (role=complementary), so the answer and its source are read together.
export function SourceSheet({ kbId, docId, onClose }: Props) {
  const { t, language } = useLanguage();
  const { api } = useChat();
  const desktop = useIsDesktop();
  const [doc, setDoc] = React.useState<DocumentView | null>(null);
  const [error, setError] = React.useState<'forbidden' | 'notFound' | 'failed' | null>(null);

  React.useEffect(() => {
    setDoc(null);
    setError(null);
    if (!docId) return;
    let cancelled = false;
    api
      .document(kbId, docId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) setError('forbidden');
        else if (e instanceof ApiError && e.status === 404 && e.code !== 'chat_disabled') setError('notFound');
        else if (!(e instanceof ApiError && (e.status === 401 || e.code === 'chat_disabled'))) setError('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [api, kbId, docId]);

  const subtitle = doc
    ? doc.updatedAt
      ? `${t(`sourceSheet.type.${doc.type}`)} · ${new Date(doc.updatedAt).toLocaleDateString(language === 'es' ? 'es' : 'en')}`
      : t(`sourceSheet.type.${doc.type}`)
    : undefined;

  const body = (
    <>
      {!doc && !error && (
        <p role="status" className="py-6 text-center text-muted-foreground">
          {t('sourceSheet.loading')}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="source-error" className="py-6 text-center text-destructive">
          {t(`sourceSheet.${error}`)}
        </p>
      )}
      {doc && <Markdown markdown={doc.markdown} />}
    </>
  );

  if (desktop) {
    if (!docId) return null;
    return (
      <aside
        role="complementary"
        aria-label={t('desktop.sourcePanel')}
        data-testid="source-panel"
        className="flex w-[420px] shrink-0 flex-col border-l border-border bg-card text-card-foreground"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-tight">{doc?.title ?? t('sourceSheet.title')}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <IconButton label={t('app.close')} onClick={onClose}>
            <X strokeWidth={1.75} />
          </IconButton>
        </div>
        <div className="scroll-area px-4 py-4">{body}</div>
      </aside>
    );
  }

  return (
    <Sheet open={!!docId} onOpenChange={(o) => !o && onClose()} heading={doc?.title ?? t('sourceSheet.title')} description={subtitle}>
      {body}
    </Sheet>
  );
}

import * as React from 'react';
import { Markdown } from '@/components/Markdown';
import { Sheet } from '@/components/Sheet';
import { useLanguage } from '@/i18n/use-language';
import { api, ApiError, type DocumentView } from '@/lib/api';

type Props = { kbId: string; docId: string | null; onClose: () => void };

// FR-016: the cited source in reading mode, inside the app. 403 → permission
// notice (the document may be private to someone else).
export function SourceSheet({ kbId, docId, onClose }: Props) {
  const { t, language } = useLanguage();
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
        else if (e instanceof ApiError && e.status === 404) setError('notFound');
        else if (!(e instanceof ApiError && e.status === 401)) setError('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, docId]);

  const subtitle = doc
    ? doc.updatedAt
      ? `${t(`sourceSheet.type.${doc.type}`)} · ${new Date(doc.updatedAt).toLocaleDateString(language === 'es' ? 'es' : 'en')}`
      : t(`sourceSheet.type.${doc.type}`)
    : undefined;

  return (
    <Sheet open={!!docId} onOpenChange={(o) => !o && onClose()} heading={doc?.title ?? t('sourceSheet.title')} description={subtitle}>
      {!doc && !error && (
        <p role="status" className="py-6 text-center text-mutedForeground">
          {t('sourceSheet.loading')}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="source-error" className="py-6 text-center text-destructive">
          {t(`sourceSheet.${error}`)}
        </p>
      )}
      {doc && <Markdown markdown={doc.markdown} />}
    </Sheet>
  );
}

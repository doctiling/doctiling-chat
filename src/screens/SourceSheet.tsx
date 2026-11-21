import * as React from 'react';
import { ArrowLeft, Maximize2, Minimize2, X } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { ListenControls } from '../components/ListenControls';
import { Markdown } from '../components/Markdown';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { Sheet } from '../components/Sheet';
import { useLanguage } from '../i18n/use-language';
import { ApiError, type DocumentView } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { useIsDesktop } from '../lib/media';
import { KEY_STEP, usePanelWidth } from '../lib/panel-width';
import { ANY_DOCUMENT, useRealtime } from '../lib/realtime';
import { speakableText } from '../lib/speakable';

type Props = {
  kbId: string;
  docId: string | null;
  onClose: () => void;
  /** Back to the documents of the base (desktop: the list panel; phone: the Documents screen). */
  onBack?: () => void;
};

// FR-016: the cited source in reading mode, inside the app. 403 → permission
// notice (the document may be private to someone else). On a phone it is a
// bottom sheet (dialog); from md it is a side panel next to the conversation
// (role=complementary), so the answer and its source are read together.
export function SourceSheet({ kbId, docId, onClose, onBack }: Props) {
  const { t, language } = useLanguage();
  const { api } = useChat();
  const desktop = useIsDesktop();
  const panelRef = React.useRef<HTMLElement>(null);
  const { width, setWidth, expanded, toggleExpanded, watch } = usePanelWidth(panelRef);
  const panelShown = desktop && !!docId;
  React.useEffect(() => (panelShown ? watch() : undefined), [panelShown, watch]);
  const [dragging, setDragging] = React.useState(false);
  // Drag the left edge: the panel grows to the left. Pointer capture keeps the drag on fast moves.
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    setDragging(true);
    const move = (ev: PointerEvent) => setWidth(startWidth + (startX - ev.clientX), false);
    const end = (ev: PointerEvent) => {
      setWidth(startWidth + (startX - ev.clientX));
      setDragging(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
  const onHandleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setWidth(width + KEY_STEP);
    else if (e.key === 'ArrowRight') setWidth(width - KEY_STEP);
    else return;
    e.preventDefault();
  };
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

  // Spec 072: the open document follows its changes (the agent's, a job's, another member's). The
  // current copy stays on screen while the new one loads, so the reader keeps their place; a failed
  // refetch keeps what is shown.
  const [version, setVersion] = React.useState(0);
  useRealtime(api, docId ? kbId : null, (event) => {
    if (event.type === 'resync') return setVersion((v) => v + 1);
    const s = event.signal;
    if (s.kind === 'doc.changed' && s.kbId === kbId && (s.docId === docId || s.docId === ANY_DOCUMENT)) setVersion((v) => v + 1);
  });
  React.useEffect(() => {
    if (!docId || version === 0) return;
    let cancelled = false;
    api
      .document(kbId, docId)
      .then((d) => {
        if (!cancelled) {
          setDoc(d);
          setError(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, kbId, docId, version]);

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
      {doc && (
        <>
          <ListenControls id={`doc:${doc.id}`} text={speakableText(doc.markdown)} listenLabel={t('sourceSheet.listen')} />
          <Markdown markdown={doc.markdown} />
        </>
      )}
    </>
  );

  if (desktop) {
    if (!docId) return null;
    return (
      <aside
        ref={panelRef}
        role="complementary"
        aria-label={t('desktop.sourcePanel')}
        data-testid="source-panel"
        style={{ width }}
        className={`relative flex shrink-0 flex-col border-l border-border bg-card text-card-foreground ${dragging ? 'select-none' : ''}`}
      >
        <SimpleTooltip label={t('sourceSheet.resize')} side="left">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('sourceSheet.resize')}
            aria-valuenow={width}
            tabIndex={0}
            data-testid="source-panel-resize"
            onPointerDown={startDrag}
            onKeyDown={onHandleKey}
            className={`absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-primary focus-visible:after:bg-primary ${dragging ? 'after:bg-primary' : ''}`}
          />
        </SimpleTooltip>
        <div className="flex items-start justify-between gap-2 border-b border-border px-2 py-3 pr-4">
          <div className="flex min-w-0 items-start gap-1">
            {onBack && (
              <IconButton label={t('sourceSheet.backToDocuments')} onClick={onBack} data-testid="source-back">
                <ArrowLeft strokeWidth={1.75} />
              </IconButton>
            )}
            <div className="min-w-0 pl-1 pt-1">
              <h2 className="font-display text-lg font-semibold leading-tight">{doc?.title ?? t('sourceSheet.title')}</h2>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <IconButton
              label={t(expanded ? 'sourceSheet.shrink' : 'sourceSheet.expand')}
              onClick={toggleExpanded}
              aria-pressed={expanded}
              data-testid="source-expand"
            >
              {expanded ? <Minimize2 strokeWidth={1.75} /> : <Maximize2 strokeWidth={1.75} />}
            </IconButton>
            <IconButton label={t('app.close')} onClick={onClose}>
              <X strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
        <div className="scroll-area px-4 py-4">{body}</div>
      </aside>
    );
  }

  return (
    <Sheet open={!!docId} onOpenChange={(o) => !o && onClose()} heading={doc?.title ?? t('sourceSheet.title')} description={subtitle}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          data-testid="source-back"
          className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {t('sourceSheet.backToDocuments')}
        </button>
      )}
      {body}
    </Sheet>
  );
}

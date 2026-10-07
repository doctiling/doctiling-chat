import * as React from 'react';
import { ArrowLeft, Lock, Search, X } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { Input } from '@doctiling/ui/atoms/input';
import { DocTypeIcon } from '../components/DocTypeIcon';
import { IconButton } from '../components/IconButton';
import { useLanguage } from '../i18n/use-language';
import type { DocumentListItem } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { filterDocuments, useDocuments } from '../lib/documents';
import { navigate } from '../lib/router';

type Props = {
  kbId: string;
  /**
   * `screen` (default): the mobile screen at `/kb/:id/docs` (`<main class="app-shell">`, back → conversation).
   * `panel`: the desktop side panel (`<aside role="complementary">`) shown in place of the source panel.
   */
  variant?: 'screen' | 'panel';
  /** Panel only: the toggle in the conversation header closes it. */
  onClose?: () => void;
};

// The documents of the open base the person may read, as the server lists them
// (own private ones included, others' excluded). A tap opens the document in
// reading mode (route /kb/:id/doc/:docId → SourceSheet / side panel). The same
// cached list feeds the `@` picker of the composer.
export function Documents({ kbId, variant = 'screen', onClose }: Props) {
  const { t } = useLanguage();
  const { api, paths } = useChat();
  const { items, error, reload } = useDocuments(api, kbId);
  const [query, setQuery] = React.useState('');
  const panel = variant === 'panel';
  const shown = React.useMemo(() => (items ? filterDocuments(items, query) : []), [items, query]);

  const list = (
    <>
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('documents.filter')}
            placeholder={t('documents.filter')}
            autoComplete="off"
            className="h-11 min-h-[44px] pl-9 text-base md:text-base"
          />
        </div>
      </div>
      {items === null && !error && (
        <p role="status" className="px-4 py-8 text-center text-muted-foreground">
          {t('app.loading')}
        </p>
      )}
      {error && (
        <div className="px-4 py-8 text-center">
          <p role="alert" className="text-destructive">
            {t(`documents.${error}`)}
          </p>
          <Button variant="outline" size="lg" className="mt-3" onClick={() => void reload()}>
            {t('app.retry')}
          </Button>
        </div>
      )}
      {items && items.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground" data-testid="documents-empty">
          {t('documents.empty')}
        </p>
      )}
      {items && items.length > 0 && shown.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground" data-testid="documents-no-match">
          {t('documents.noMatch', { query: query.trim() })}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-border" aria-label={t('documents.title')}>
          {shown.map((d) => (
            <li key={d.id}>
              <DocumentRow doc={d} onOpen={() => navigate(paths.document(kbId, d.id))} />
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (panel) {
    return (
      <aside
        role="complementary"
        aria-label={t('documents.title')}
        data-testid="documents-panel"
        className="flex w-[420px] shrink-0 flex-col border-l border-border bg-card text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-tight">{t('documents.title')}</h2>
            {items && <p className="mt-0.5 text-sm text-muted-foreground">{items.length === 1 ? t('kb.documentsOne') : t('kb.documents', { count: items.length })}</p>}
          </div>
          {onClose && (
            <IconButton label={t('app.close')} onClick={onClose}>
              <X strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
        <div className="scroll-area">{list}</div>
      </aside>
    );
  }

  return (
    <main className="app-shell">
      <header className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <IconButton label={t('app.back')} onClick={() => navigate(paths.conversation(kbId))}>
          <ArrowLeft strokeWidth={1.75} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold">{t('documents.title')}</h1>
          {items && <p className="truncate text-xs text-muted-foreground">{items.length === 1 ? t('kb.documentsOne') : t('kb.documents', { count: items.length })}</p>}
        </div>
      </header>
      <div className="scroll-area">{list}</div>
    </main>
  );
}

function DocumentRow({ doc, onOpen }: { doc: DocumentListItem; onOpen: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      data-doc={doc.id}
      onClick={onOpen}
      className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <DocTypeIcon type={doc.type} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{doc.title}</span>
          {doc.visibility === 'private' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground" data-testid="doc-private">
              <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {t('documents.private')}
            </span>
          )}
        </div>
        {(doc.parentTitle || !doc.indexed) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {doc.parentTitle}
            {doc.parentTitle && !doc.indexed ? ' · ' : ''}
            {!doc.indexed && <span data-testid="doc-not-indexed">{t('documents.notIndexed')}</span>}
          </p>
        )}
      </div>
    </button>
  );
}

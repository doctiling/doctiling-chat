import * as React from 'react';
import { Button } from '@doctiling/ui/atoms/button';
import { Input } from '@doctiling/ui/atoms/input';
import { useLanguage } from '../../i18n/use-language';
import type { DocumentListItem } from '../../lib/api';
import { useChat } from '../../lib/chat-context';
import { errorCode, errorKey } from '../../lib/new-document';

type Props = { kbId: string; type: 'text' | 'database' | 'graph'; onDone: (doc: DocumentListItem) => void };

// spec 054 FR-008: blank, table or graph — a title, and the empty document of that type.
export function EmptyDocFlow({ kbId, type, onDone }: Props) {
  const { t } = useLanguage();
  const { api } = useChat();
  const [title, setTitle] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const guard = React.useRef(false);
  const id = React.useId();

  const create = async () => {
    const value = title.trim();
    if (!value || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      onDone(await api.createDocument(kbId, { type, title: value }));
    } catch (e) {
      setError(errorCode(e));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">{t('newDocument.titleLabel')}</label>
        <Input
          id={id}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('newDocument.titlePlaceholder')}
          autoComplete="off"
          className="h-11 min-h-[44px] text-base md:text-base"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey(error))}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !title.trim()}>
        {busy ? t('newDocument.creating') : t('newDocument.create')}
      </Button>
    </form>
  );
}

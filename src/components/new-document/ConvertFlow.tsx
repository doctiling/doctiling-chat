import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { useLanguage } from '../../i18n/use-language';
import type { ConvertedSheet, DocumentListItem } from '../../lib/api';
import { useChat } from '../../lib/chat-context';
import { CONVERT_ACCEPT, MAX_FILES_PER_BATCH, errorCode, errorKey } from '../../lib/new-document';
import { SheetPicker } from './SheetPicker';

type Props = {
  kbId: string;
  /** Every document the operation created (unindexed) and the files that failed, already worded. */
  onDone: (created: DocumentListItem[], problems: string[]) => void;
};

type Picking = { name: string; sheets: ConvertedSheet[]; resolve: (chosen: ConvertedSheet[]) => void };

// spec 054 FR-003: one or several files go through the server's converters one by one; text becomes a text
// document (a graph when the server found one in it), a sheet a table document (several sheets → the person picks).
// Nothing is indexed here.
export function ConvertFlow({ kbId, onDone }: Props) {
  const { t } = useLanguage();
  const { api } = useChat();
  const input = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState<Picking | null>(null);
  const [problems, setProblems] = React.useState<string[]>([]);
  const busy = React.useRef(false);

  const reason = (code: string) => t(errorKey(code));

  const run = async (files: File[]) => {
    if (busy.current || files.length === 0) return;
    if (files.length > MAX_FILES_PER_BATCH) {
      setProblems([t('newDocument.convert.tooMany', { max: MAX_FILES_PER_BATCH })]);
      return;
    }
    busy.current = true;
    setProblems([]);
    const created: DocumentListItem[] = [];
    const failed: string[] = [];
    for (const file of files) {
      setProgress(t('newDocument.convert.progress', { name: file.name }));
      try {
        const result = await api.convertDocument(kbId, file);
        if (result.kind === 'text') {
          // A text that lists nodes and arrows arrives with its graph already built: it becomes a graph document.
          const doc = result.graph
            ? { type: 'graph' as const, title: result.title, content: result.graph }
            : { type: 'text' as const, title: result.title, content: result.markdown };
          created.push(await api.createDocument(kbId, doc));
          continue;
        }
        const chosen =
          result.sheets.length > 1
            ? await new Promise<ConvertedSheet[]>((resolve) => setPicking({ name: file.name, sheets: result.sheets, resolve }))
            : result.sheets;
        setPicking(null);
        for (const sheet of chosen) {
          const title = result.sheets.length > 1 ? `${result.title} — ${sheet.name}` : result.title;
          created.push(await api.createDocument(kbId, { type: 'database', title, content: JSON.stringify(sheet.table) }));
        }
      } catch (e) {
        failed.push(t('newDocument.convert.failedFile', { name: file.name, reason: reason(errorCode(e)) }));
      }
    }
    setProgress(null);
    busy.current = false;
    if (input.current) input.current.value = '';
    if (created.length > 0) onDone(created, failed);
    else setProblems([...failed, t('newDocument.convert.noneCreated')]);
  };

  if (picking) {
    return <SheetPicker name={picking.name} sheets={picking.sheets} onConfirm={picking.resolve} onSkip={() => picking.resolve([])} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('newDocument.convert.hint', { max: MAX_FILES_PER_BATCH })}</p>
      <input
        ref={input}
        type="file"
        multiple
        accept={CONVERT_ACCEPT}
        aria-label={t('newDocument.convert.choose')}
        data-testid="convert-input"
        className="sr-only"
        onChange={(e) => void run(Array.from(e.target.files ?? []))}
      />
      <Button size="lg" className="w-full gap-2" disabled={progress !== null} onClick={() => input.current?.click()}>
        <Upload className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        {t('newDocument.convert.choose')}
      </Button>
      {progress && (
        <p role="status" className="text-sm text-muted-foreground">
          {progress}
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

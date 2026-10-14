import * as React from 'react';
import { ArrowLeft, FilePlus2, FileText, Sparkles, Table2, Upload, Waypoints } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';
import { IconButton } from './IconButton';
import { IndexPrompt } from './IndexPrompt';
import { Sheet } from './Sheet';
import { ConvertFlow } from './new-document/ConvertFlow';
import { EmptyDocFlow } from './new-document/EmptyDocFlow';
import { GenerateFlow } from './new-document/GenerateFlow';
import { useLanguage } from '../i18n/use-language';
import type { DocumentListItem } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { useOnline } from '../lib/online';

type Method = 'generate' | 'blank' | 'table' | 'graph' | 'convert';

type Step =
  | { kind: 'methods' }
  | { kind: 'flow'; method: Method }
  | { kind: 'index'; documents: DocumentListItem[]; problems: string[] }
  | { kind: 'created'; document: DocumentListItem };

type Props = {
  kbId: string;
  /** Admin or above on the base; otherwise the trigger is disabled and says why (the server refuses anyway). */
  canCreate: boolean;
  /** `icon` in the composer, `button` in the documents list. */
  variant?: 'icon' | 'button';
  /** Every new document, as soon as it exists (the list refreshes). */
  onCreated?: (documents: DocumentListItem[]) => void;
  /** Offered after a blank, table or graph document: put it in the composer for the agent. */
  onAskAgent?: (document: DocumentListItem) => void;
};

const METHODS: { method: Method; Icon: typeof FileText }[] = [
  { method: 'generate', Icon: Sparkles },
  { method: 'blank', Icon: FileText },
  { method: 'table', Icon: Table2 },
  { method: 'graph', Icon: Waypoints },
  { method: 'convert', Icon: Upload },
];

const EMPTY_TYPE = { blank: 'text', table: 'database', graph: 'graph' } as const;

// spec 054: the studio's five creation methods inside the chat. Documents are born unindexed; content-bearing ones
// (convert, generate) end in one "Index now?" question per operation, empty ones offer the studio or the agent.
export function NewDocumentSheet({ kbId, canCreate, variant = 'icon', onCreated, onAskAgent }: Props) {
  const { t } = useLanguage();
  const { studioHref } = useChat();
  const online = useOnline();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>({ kind: 'methods' });

  const usable = canCreate && online;
  const reason = canCreate ? t('newDocument.open') : t('newDocument.disabledReason');
  const openSheet = () => {
    if (!usable) return;
    setStep({ kind: 'methods' });
    setOpen(true);
  };
  const close = () => setOpen(false);
  const created = (documents: DocumentListItem[]) => onCreated?.(documents);

  const trigger =
    variant === 'icon' ? (
      <IconButton label={reason} tooltipSide="top" aria-disabled={!usable} data-testid="new-document" onClick={openSheet} className={usable ? '' : 'opacity-50'}>
        <FilePlus2 strokeWidth={1.75} />
      </IconButton>
    ) : (
      <SimpleTooltip label={reason} side="bottom">
        <Button variant="outline" size="lg" aria-disabled={!usable} data-testid="new-document" onClick={openSheet} className={`gap-2 px-3 ${usable ? '' : 'opacity-50'}`}>
          <FilePlus2 className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          {t('newDocument.open')}
        </Button>
      </SimpleTooltip>
    );

  const heading =
    step.kind === 'flow' ? t(`newDocument.methods.${step.method}.title`) : step.kind === 'created' ? t('newDocument.created.heading') : t('newDocument.heading');

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen} heading={heading} description={step.kind === 'methods' ? t('newDocument.description') : undefined}>
        {step.kind === 'methods' && (
          <ul className="space-y-2" aria-label={t('newDocument.heading')}>
            {METHODS.map(({ method, Icon }) => (
              <li key={method}>
                <button
                  type="button"
                  data-method={method}
                  onClick={() => setStep({ kind: 'flow', method })}
                  className="flex min-h-[56px] w-full items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-medium">{t(`newDocument.methods.${method}.title`)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`newDocument.methods.${method}.body`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {step.kind === 'flow' && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => setStep({ kind: 'methods' })}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t('newDocument.back')}
            </Button>
            {step.method === 'convert' && (
              <ConvertFlow
                kbId={kbId}
                onDone={(documents, problems) => {
                  created(documents);
                  setStep({ kind: 'index', documents, problems });
                }}
              />
            )}
            {step.method === 'generate' && (
              <GenerateFlow
                kbId={kbId}
                onDone={(document) => {
                  created([document]);
                  setStep({ kind: 'index', documents: [document], problems: [] });
                }}
              />
            )}
            {(step.method === 'blank' || step.method === 'table' || step.method === 'graph') && (
              <EmptyDocFlow
                kbId={kbId}
                type={EMPTY_TYPE[step.method]}
                onDone={(document) => {
                  created([document]);
                  setStep({ kind: 'created', document });
                }}
              />
            )}
          </div>
        )}
        {step.kind === 'index' && (
          <IndexPrompt kbId={kbId} documents={step.documents} problems={step.problems} onClose={close} onIndexed={() => onCreated?.([])} />
        )}
        {step.kind === 'created' && (
          <div className="space-y-3" data-testid="document-created">
            <p className="text-sm text-muted-foreground">{t('newDocument.created.body', { title: step.document.title })}</p>
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={`${studioHref.replace(/\/+$/, '')}/${encodeURIComponent(kbId)}/${encodeURIComponent(step.document.id)}`}>{t('newDocument.created.openStudio')}</a>
            </Button>
            {onAskAgent && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  onAskAgent(step.document);
                  close();
                }}
              >
                {t('newDocument.created.askAgent')}
              </Button>
            )}
            <Button size="lg" className="w-full" onClick={close}>
              {t('newDocument.created.done')}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

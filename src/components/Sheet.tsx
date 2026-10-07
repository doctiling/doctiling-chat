import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useLanguage } from '@/i18n/use-language';

// Bottom sheet on phones, centred dialog on wide screens. Radix handles focus
// trap, Escape and aria wiring; the sheet only styles it.
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visible heading (Radix Dialog.Title); named `heading` because `title=` is banned in JSX. */
  heading: string;
  description?: string;
  children: React.ReactNode;
  /** Blocks dismissal by overlay click / Escape (local confirmations). */
  modal?: boolean;
};

export function Sheet({ open, onOpenChange, heading: title, description, children, modal = false }: Props) {
  const { t } = useLanguage();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          onInteractOutside={(e) => modal && e.preventDefault()}
          onEscapeKeyDown={(e) => modal && e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-card text-cardForeground shadow-xl focus:outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <div className="flex items-start gap-2 border-b border-border px-4 pt-3 pb-2">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-2 px-4 pb-2">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-semibold leading-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-mutedForeground">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            {!modal && (
              <Dialog.Close asChild>
                <IconButton label={t('app.close')}>
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </IconButton>
              </Dialog.Close>
            )}
          </div>
          <div className="scroll-area safe-bottom px-4 pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

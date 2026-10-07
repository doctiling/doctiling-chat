import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Sheet as SheetRoot, SheetClose, SheetDescription, SheetOverlay, SheetPortal, SheetTitle } from '@doctiling/ui/molecules/sheet';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useLanguage } from '../i18n/use-language';

// Bottom sheet on phones, centred dialog on wide screens, built from the design
// system's Sheet parts. The content panel is the Radix primitive the design
// system wraps: its SheetContent bakes in an English close button and a
// hidden "Navigation Menu" title, both of which this app replaces with
// translated, labelled ones (Constitution P2, P3).
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
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay className="z-40 bg-black/40 backdrop-blur-none" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => modal && e.preventDefault()}
          onEscapeKeyDown={(e) => modal && e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-xl focus:outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <div className="flex items-start gap-2 border-b border-border px-4 pt-3 pb-2">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-2 px-4 pb-2">
            <div className="min-w-0">
              <SheetTitle className="font-display text-lg font-semibold leading-tight text-card-foreground">{title}</SheetTitle>
              {description ? (
                <SheetDescription className="mt-1">{description}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">{title}</SheetDescription>
              )}
            </div>
            {!modal && (
              <SheetClose asChild>
                <IconButton label={t('app.close')}>
                  <X strokeWidth={1.75} />
                </IconButton>
              </SheetClose>
            )}
          </div>
          <div className="scroll-area safe-bottom px-4 pb-4">{children}</div>
        </DialogPrimitive.Content>
      </SheetPortal>
    </SheetRoot>
  );
}

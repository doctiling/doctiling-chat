import * as React from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { IconButton } from './IconButton';
import { useLanguage } from '../i18n/use-language';
import { useIsDesktop } from '../lib/media';

type Props = {
  onSend: (query: string) => void;
  onStop: () => void;
  running: boolean;
  disabled?: boolean;
  hint?: string;
  /** A follow-up chip puts its question in the box; the nonce lets the same text be picked twice. */
  prefill?: { text: string; nonce: number } | null;
};

// FR-022: pinned above the keyboard. The shell height follows visualViewport
// (see useVisualViewportHeight in app.tsx) and the safe-area inset keeps the
// controls above the home bar. Double tap on send produces one request: the
// query is cleared synchronously before the parent is called.
// Enter sends only on desktop (≥ md, a physical keyboard is likely); on a phone
// Enter is a newline and the Send button is the only way to send.
export function Composer({ onSend, onStop, running, disabled = false, hint, prefill }: Props) {
  const { t } = useLanguage();
  const desktop = useIsDesktop();
  const [value, setValue] = React.useState('');
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (!prefill) return;
    setValue(prefill.text);
    ref.current?.focus();
  }, [prefill]);
  const sending = React.useRef(false);

  const send = () => {
    const q = value.trim();
    if (!q || running || disabled || sending.current) return;
    sending.current = true;
    setValue('');
    onSend(q);
    // release on the next tick: a second tap in the same gesture finds an empty value anyway.
    window.setTimeout(() => {
      sending.current = false;
    }, 0);
  };

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Send and Stop occupy the same spot: a second tap of a double tap must not land on
  // Stop and abort the run it just started. Distinct keys give each its own DOM node and
  // Stop ignores taps during its first 400 ms.
  const runningSince = React.useRef(0);
  React.useEffect(() => {
    if (running) runningSince.current = Date.now();
  }, [running]);
  const stop = () => {
    if (Date.now() - runningSince.current < 400) return;
    onStop();
  };

  return (
    <form
      className="safe-bottom border-t border-border bg-background px-3 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      data-testid="composer"
    >
      <div className="mx-auto w-full md:max-w-[760px]">
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-card px-3 py-1.5">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (desktop && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={disabled}
          enterKeyHint={desktop ? 'send' : 'enter'}
          autoComplete="off"
          aria-label={t('conversation.placeholder')}
          placeholder={t('conversation.placeholder')}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-card-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {running ? (
          <IconButton key="stop" label={t('conversation.stop')} variant="destructive" tooltipSide="top" onClick={stop}>
            <Square className="h-5 w-5" strokeWidth={2} fill="currentColor" />
          </IconButton>
        ) : (
          <IconButton
            key="send"
            label={t('conversation.send')}
            variant="primary"
            tooltipSide="top"
            type="submit"
            disabled={disabled || !value.trim()}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2} />
          </IconButton>
        )}
      </div>
      {(hint || desktop) && (
        <p className="mt-1 px-1 text-center text-[11px] text-muted-foreground">
          {desktop && <span className="mr-2">{t('desktop.enterHint')}</span>}
          {hint}
        </p>
      )}
      </div>
    </form>
  );
}

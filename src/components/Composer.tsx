import * as React from 'react';
import { ArrowUp, Square, X } from 'lucide-react';
import { DocTypeIcon } from './DocTypeIcon';
import { IconButton } from './IconButton';
import { useLanguage } from '../i18n/use-language';
import { MAX_REFERENCES, type DocumentListItem } from '../lib/api';
import { filterDocuments, mentionAt } from '../lib/documents';
import { useIsDesktop } from '../lib/media';

type Props = {
  /** The question and the ids of the documents pointed at with `@` (empty when none). */
  onSend: (query: string, referencedDocumentIds: string[]) => void;
  onStop: () => void;
  running: boolean;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  /** A follow-up chip puts its question in the box; the nonce lets the same text be picked twice. */
  prefill?: { text: string; nonce: number } | null;
  /** The base's readable documents for the `@` picker; undefined while they load (the picker says so). */
  documents?: DocumentListItem[] | null;
};

const PICKER_SIZE = 8;

// FR-022: pinned above the keyboard. The shell height follows visualViewport
// (see useVisualViewportHeight in app.tsx) and the safe-area inset keeps the
// controls above the home bar. Double tap on send produces one request: the
// query is cleared synchronously before the parent is called.
// Enter sends only on desktop (≥ md, a physical keyboard is likely); on a phone
// Enter is a newline and the Send button is the only way to send.
// `@` opens a picker over the base's documents; a choice becomes a chip above
// the box and the `@…` text leaves the question. Chips travel as
// `referencedDocumentIds`, never inside the query text.
export function Composer({ onSend, onStop, running, disabled = false, hint, placeholder, prefill, documents }: Props) {
  const { t } = useLanguage();
  const desktop = useIsDesktop();
  const [value, setValue] = React.useState('');
  const [chips, setChips] = React.useState<DocumentListItem[]>([]);
  const [mention, setMention] = React.useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = React.useState(0);
  const [limitHit, setLimitHit] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (!prefill) return;
    setValue(prefill.text);
    setMention(null);
    ref.current?.focus();
  }, [prefill]);
  const sending = React.useRef(false);

  const send = () => {
    const q = value.trim();
    if (!q || running || disabled || sending.current) return;
    sending.current = true;
    setValue('');
    setMention(null);
    setLimitHit(false);
    const ids = chips.map((c) => c.id);
    setChips([]);
    onSend(q, ids);
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

  // ---- @ mentions ----------------------------------------------------------
  const candidates = React.useMemo(() => {
    if (!mention || !documents) return [];
    const taken = new Set(chips.map((c) => c.id));
    return filterDocuments(documents, mention.query)
      .filter((d) => !taken.has(d.id))
      .slice(0, PICKER_SIZE);
  }, [mention, documents, chips]);
  React.useEffect(() => {
    setActive(0);
  }, [mention?.query, candidates.length]);

  const updateMention = (text: string, caret: number) => setMention(mentionAt(text, caret));

  const pick = (doc: DocumentListItem) => {
    if (mention) {
      const end = mention.start + 1 + mention.query.length;
      const next = `${value.slice(0, mention.start)}${value.slice(end).replace(/^\s/, '')}`;
      setValue(next);
      const caret = mention.start;
      window.setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      }, 0);
    }
    setMention(null);
    if (chips.length >= MAX_REFERENCES) {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    if (!chips.some((c) => c.id === doc.id)) setChips([...chips, doc]);
  };

  const removeChip = (id: string) => {
    setChips(chips.filter((c) => c.id !== id));
    setLimitHit(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention) {
      if (e.key === 'ArrowDown' && candidates.length) {
        e.preventDefault();
        setActive((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === 'ArrowUp' && candidates.length) {
        e.preventDefault();
        setActive((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && candidates[active]) {
        e.preventDefault();
        pick(candidates[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (desktop && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const pickerOpen = !!mention;
  const listboxId = React.useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  return (
    <form
      className="safe-bottom border-t border-border bg-background px-3 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      data-testid="composer"
    >
      <div className="relative mx-auto w-full md:max-w-[760px]">
      {pickerOpen && (
        <div
          role="listbox"
          id={listboxId}
          aria-label={t('mentions.picker')}
          data-testid="mention-picker"
          className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-md"
        >
          {!documents && (
            <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
              {t('app.loading')}
            </p>
          )}
          {documents && candidates.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">{t('mentions.noMatch')}</p>}
          {candidates.map((d, i) => (
            <div
              key={d.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              data-doc={d.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(d)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-muted' : ''}`}
            >
              <DocTypeIcon type={d.type} className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                {d.parentTitle && <span className="block truncate text-xs text-muted-foreground">{d.parentTitle}</span>}
              </div>
              {d.visibility === 'private' && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{t('documents.private')}</span>}
            </div>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-1 px-1" data-testid="mention-chips" aria-label={t('mentions.references')}>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={t('mentions.remove', { title: c.title })}
              onClick={() => removeChip(c.id)}
              className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-3 text-sm text-secondary-foreground hover:bg-muted"
            >
              <span className="truncate">@{c.title}</span>
              <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-card px-3 py-1.5">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
          rows={1}
          disabled={disabled}
          enterKeyHint={desktop ? 'send' : 'enter'}
          autoComplete="off"
          aria-controls={pickerOpen ? listboxId : undefined}
          aria-activedescendant={pickerOpen && candidates[active] ? optionId(active) : undefined}
          aria-label={placeholder ?? t('conversation.placeholder')}
          placeholder={placeholder ?? t('conversation.placeholder')}
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
      {limitHit && (
        <p role="status" data-testid="mention-limit" className="mt-1 px-1 text-center text-[11px] text-destructive">
          {t('mentions.limit', { max: MAX_REFERENCES })}
        </p>
      )}
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

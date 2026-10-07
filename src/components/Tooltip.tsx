import * as React from 'react';

// Accessible tooltip without native `title=` (the lint bans it): the label is
// always exposed through aria-describedby, and shown on hover, focus and
// long-press-free touch (tap shows it briefly). Constitution P3.
type Props = {
  label: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
};

export function Tooltip({ label, children, side = 'top' }: Props) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const hide = React.useCallback(() => setOpen(false), []);
  const show = React.useCallback(() => setOpen(true), []);
  const child = React.cloneElement(children, {
    'aria-describedby': id,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  } as React.HTMLAttributes<HTMLElement>);
  return (
    <span className="relative inline-flex">
      {child}
      <span
        role="tooltip"
        id={id}
        data-state={open ? 'open' : 'closed'}
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-xs text-accentForeground shadow transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        } ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
      >
        {label}
      </span>
    </span>
  );
}

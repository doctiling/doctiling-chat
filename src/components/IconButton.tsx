import * as React from 'react';
import { Tooltip } from './Tooltip';

// Every icon control carries a mandatory label: it is the accessible name AND
// the tooltip (Constitution P3; eslint forbids <IconButton> without `label`).
type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string;
  children: React.ReactNode;
  variant?: 'ghost' | 'primary' | 'destructive';
  tooltipSide?: 'top' | 'bottom';
};

const VARIANT = {
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  primary: 'bg-primary text-primaryForeground hover:opacity-90',
  destructive: 'bg-transparent text-destructive hover:bg-muted',
};

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, children, variant = 'ghost', tooltipSide = 'bottom', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-full p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
});

import * as React from 'react';
import { Button } from '@doctiling/ui/atoms/button';
import { SimpleTooltip } from '@doctiling/ui/molecules/tooltip';

// Every icon control carries a mandatory label: it is the accessible name AND
// the tooltip (Constitution P3; eslint forbids <IconButton> without `label`).
// Thin composition over the design system: Button (ghost, icon) + SimpleTooltip.
type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string;
  children: React.ReactNode;
  variant?: 'ghost' | 'primary' | 'destructive';
  tooltipSide?: 'top' | 'bottom';
};

const VARIANT = {
  ghost: 'ghost',
  primary: 'default',
  destructive: 'ghost',
} as const;

const EXTRA = {
  ghost: '',
  primary: '',
  destructive: 'text-destructive hover:text-destructive',
};

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, children, variant = 'ghost', tooltipSide = 'bottom', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <SimpleTooltip label={label} side={tooltipSide}>
      <Button
        ref={ref}
        type={type}
        variant={VARIANT[variant]}
        size="icon"
        aria-label={label}
        className={`h-11 w-11 min-h-[44px] min-w-[44px] rounded-full [&_svg]:size-5 ${EXTRA[variant]} ${className}`}
        {...rest}
      >
        {children}
      </Button>
    </SimpleTooltip>
  );
});

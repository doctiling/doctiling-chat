import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Pending state: disabled + spinner text; the caller guards double submit. */
  pending?: boolean;
  full?: boolean;
};

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-primaryForeground hover:opacity-90',
  secondary: 'bg-secondary text-secondaryForeground border border-border hover:bg-muted',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructiveForeground hover:opacity-90',
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', pending = false, full = false, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${
        VARIANT[variant]
      } ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

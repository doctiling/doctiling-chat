import * as React from 'react';

export type ToastItem = {
  id: number;
  message: string;
  kind?: 'info' | 'error';
  action?: { label: string; hint?: string; onClick: () => void };
  /** ms; 0 = sticky */
  duration?: number;
};

type Ctx = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => number;
  dismiss: (id: number) => void;
};

const ToastContext = React.createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);
  const dismiss = React.useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = React.useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = ++seq.current;
      setToasts((ts) => [...ts.filter((t) => t.message !== toast.message), { ...toast, id }]);
      const duration = toast.duration ?? 5000;
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );
  const value = React.useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside <ToastProvider>');
  return ctx;
}

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-2 px-3"
      role="region"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg ${
            t.kind === 'error'
              ? 'border-destructive/40 bg-card text-destructive'
              : 'border-border bg-card text-cardForeground'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="min-h-touch rounded-md px-3 font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

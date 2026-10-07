import { WifiOff } from 'lucide-react';
import { useLanguage } from '../i18n/use-language';
import { useOnline } from '../lib/online';

export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="alert"
      data-testid="offline-banner"
      className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="flex-1">{t('offline.banner')}</span>
      {onRetry && (
        <button type="button" className="min-h-[44px] px-2 font-medium text-primary" onClick={onRetry}>
          {t('offline.retry')}
        </button>
      )}
    </div>
  );
}

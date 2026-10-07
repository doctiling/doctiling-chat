import { WifiOff } from 'lucide-react';
import { Button } from '@/components/Button';
import { useLanguage } from '@/i18n/use-language';

export function Offline({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="app-shell">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <WifiOff className="h-10 w-10 text-mutedForeground" strokeWidth={1.25} aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{t('offline.title')}</h1>
        <p className="mt-2 text-mutedForeground">{t('offline.body')}</p>
        <Button className="mt-6" onClick={onRetry}>
          {t('offline.retry')}
        </Button>
      </div>
    </main>
  );
}

import { MessageSquareOff } from 'lucide-react';
import { Button } from '@doctiling/ui/atoms/button';
import { useLanguage } from '../i18n/use-language';
import { useChat } from '../lib/chat-context';

/** FR-027: a bare 404 from /api/chat/* means the tenant has no chat; the person is sent back to the studio. */
export function NotEnabled() {
  const { t } = useLanguage();
  const { studioHref } = useChat();
  return (
    <main className="app-shell">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center" data-testid="not-enabled">
        <MessageSquareOff className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{t('notEnabled.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('notEnabled.body')}</p>
        <Button asChild size="lg" className="mt-6">
          <a href={studioHref}>{t('notEnabled.cta')}</a>
        </Button>
      </div>
    </main>
  );
}

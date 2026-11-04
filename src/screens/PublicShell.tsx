import * as React from 'react';
import { useLanguage } from '../i18n/use-language';
import { ApiError } from '../lib/api';
import { useChat } from '../lib/chat-context';
import { useIsDesktop } from '../lib/media';
import { useRoute } from '../lib/router';
import { Conversation } from './Conversation';

// Spec 074 (doctiling-web): the visitor's whole app — the conversation of one
// base, full width, a cited source beside it on desktop. A link that is off,
// regenerated or unknown shows a neutral "not available" page.
export function PublicShell({ basePath, slug }: { basePath: string; slug: string }) {
  const { api } = useChat();
  const { t } = useLanguage();
  const desktop = useIsDesktop();
  const route = useRoute(basePath);
  const [state, setState] = React.useState<{ kind: 'loading' } | { kind: 'ready'; name: string } | { kind: 'unavailable' }>({ kind: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    api
      .knowledgeBases()
      .then(({ items }) => {
        if (!cancelled) setState({ kind: 'ready', name: items[0]?.name ?? '' });
      })
      .catch((e) => {
        if (!cancelled) setState(e instanceof ApiError && e.code === 'network' ? { kind: 'loading' } : { kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (state.kind === 'loading') {
    return (
      <main className="app-shell">
        <p role="status" className="px-4 py-8 text-center text-muted-foreground">
          {t('app.loading')}
        </p>
      </main>
    );
  }
  if (state.kind === 'unavailable') {
    return (
      <main className="app-shell">
        <div data-testid="public-unavailable" className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <h1 className="font-display text-2xl font-semibold">{t('publicChat.unavailable.title')}</h1>
          <p className="mt-2 max-w-md text-muted-foreground">{t('publicChat.unavailable.body')}</p>
        </div>
      </main>
    );
  }

  const docId = route.name === 'conversation' ? route.docId : undefined;
  const conversation = <Conversation key={slug} kbId={slug} kbName={state.name} docId={docId} />;
  if (!desktop) return conversation;
  return (
    <div className="desktop-shell" data-testid="public-shell">
      <div className="flex min-w-0 flex-1 flex-col">{conversation}</div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { UpdateToast } from './components/UpdateToast';
import type { Language } from './i18n';
import { LanguageProvider, useLanguage } from './i18n/use-language';
import { createChatApi } from './lib/api';
import { ChatProvider, type ChatContextValue } from './lib/chat-context';
import { useIsDesktop } from './lib/media';
import { makePaths, navigate, useRoute, type Route } from './lib/router';
import { Conversation } from './screens/Conversation';
import { Documents } from './screens/Documents';
import { KnowledgeBases } from './screens/KnowledgeBases';
import { NotEnabled } from './screens/NotEnabled';
import { Offline } from './screens/Offline';
import { Settings } from './screens/Settings';

/**
 * The whole contract between the chat and its host (the studio, doctiling-web).
 * The host mounts <ChatApp> on every path under `basePath` and passes the
 * product routes the chat links to; the chat never imports product code.
 */
export type ChatAppProps = {
  /** Where the host mounts the chat, e.g. `/es/chat`. Own history router below it. */
  basePath: string;
  /** UI language, decided by the host (URL segment). */
  locale: Language;
  /** Prefix for `/api/chat/*` calls; '' (default) = same origin, same session cookie. */
  apiBase?: string;
  /** Studio sign-in page; a 401 sends the person there with `?callbackUrl=<current path>`. */
  signInHref: string;
  /** The studio itself (back link, "chat not enabled" screen). */
  studioHref: string;
  /** Studio sign-out; "Sign out" in Settings is a plain link to it (one session). */
  signOutHref: string;
  /** Shown in Settings. */
  version?: string;
};

// FR-022: the shell follows the visual viewport so the composer stays above
// the keyboard on iOS, where 100dvh does not shrink with it.
function useVisualViewportHeight() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      document.documentElement.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);
}

// Desktop (≥ md, decided by viewport size, never by user agent): the base list
// stays in a 320 px left column and the route decides the right column —
// conversation, settings or the "pick a base" empty state. Routes and basePath
// are the same as on a phone; only the shell differs.
function DesktopShell({ route }: { route: Route }) {
  const { t } = useLanguage();
  const kbId = route.name === 'conversation' || route.name === 'documents' ? route.kbId : undefined;
  return (
    <div className="desktop-shell" data-testid="desktop-shell">
      <div className="flex w-80 shrink-0 flex-col border-r border-border">
        <KnowledgeBases variant="sidebar" selectedId={kbId} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {route.name === 'conversation' && <Conversation key={route.kbId} kbId={route.kbId} docId={route.docId} />}
        {route.name === 'documents' && <Conversation key={route.kbId} kbId={route.kbId} docsOpen />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'kbs' && (
          <section data-testid="desktop-empty" className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold">{t('desktop.pickBase')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('desktop.pickBaseBody')}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Router({ basePath }: { basePath: string }) {
  const route = useRoute(basePath);
  const paths = React.useMemo(() => makePaths(basePath), [basePath]);
  const desktop = useIsDesktop();
  useVisualViewportHeight();
  if (desktop && route.name !== 'offline') return <DesktopShell route={route} />;
  switch (route.name) {
    case 'conversation':
      return <Conversation key={route.kbId} kbId={route.kbId} docId={route.docId} />;
    case 'documents':
      return <Documents kbId={route.kbId} />;
    case 'settings':
      return <Settings />;
    case 'offline':
      return <Offline onRetry={() => navigate(paths.kbs(), { replace: true })} />;
    case 'kbs':
    default:
      return <KnowledgeBases />;
  }
}

export function ChatApp({ basePath, locale, apiBase = '', signInHref, studioHref, signOutHref, version = 'dev' }: ChatAppProps) {
  const base = basePath.replace(/\/+$/, '') || '/';
  const [disabled, setDisabled] = React.useState(false);
  const api = React.useMemo(
    () => createChatApi({ apiBase, signInHref, onDisabled: () => setDisabled(true) }),
    [apiBase, signInHref],
  );
  const value = React.useMemo<ChatContextValue>(
    () => ({ basePath: base, locale, signInHref, studioHref, signOutHref, version, api, paths: makePaths(base) }),
    [base, locale, signInHref, studioHref, signOutHref, version, api],
  );
  return (
    <ChatProvider value={value}>
      <LanguageProvider language={locale}>
        <ToastProvider>
          {disabled ? (
            <NotEnabled />
          ) : (
            <>
              <Router basePath={base} />
              <UpdateToast />
            </>
          )}
        </ToastProvider>
      </LanguageProvider>
    </ChatProvider>
  );
}

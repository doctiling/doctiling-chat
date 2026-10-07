import * as React from 'react';
import { ToastProvider } from '@/components/Toast';
import { UpdateToast } from '@/components/UpdateToast';
import { LanguageProvider, useLanguage } from '@/i18n/use-language';
import { ConfigError, config } from '@/config';
import { onSignOut, type SignOutReason } from '@/lib/api';
import { navigate, paths, useRoute } from '@/lib/router';
import { getToken } from '@/lib/storage';
import { Callback } from '@/screens/Callback';
import { Connect } from '@/screens/Connect';
import { Conversation } from '@/screens/Conversation';
import { KnowledgeBases } from '@/screens/KnowledgeBases';
import { Offline } from '@/screens/Offline';
import { Settings } from '@/screens/Settings';

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

function Router() {
  const route = useRoute();
  const [hasToken, setHasToken] = React.useState<boolean | null>(null);
  const [reason, setReason] = React.useState<SignOutReason | null>(null);
  useVisualViewportHeight();

  React.useEffect(() => {
    let alive = true;
    getToken().then((tkn) => alive && setHasToken(!!tkn));
    const off = onSignOut((why) => {
      setHasToken(false);
      setReason(why);
      navigate(paths.connect(), { replace: true });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Route guards: no token → Connect (except the callback); token on Connect → bases.
  React.useEffect(() => {
    if (hasToken === null) return;
    if (!hasToken && route.name !== 'connect' && route.name !== 'callback' && route.name !== 'offline') {
      navigate(paths.connect(), { replace: true });
    } else if (hasToken && route.name === 'connect') {
      navigate(paths.kbs(), { replace: true });
    }
  }, [hasToken, route]);

  if (hasToken === null) return null;

  switch (route.name) {
    case 'callback':
      return (
        <Callback
          onConnected={() => {
            setReason(null);
            setHasToken(true);
            navigate(paths.kbs(), { replace: true });
          }}
        />
      );
    case 'kbs':
      return hasToken ? <KnowledgeBases /> : null;
    case 'conversation':
      return hasToken ? <Conversation key={route.kbId} kbId={route.kbId} docId={route.docId} /> : null;
    case 'settings':
      return hasToken ? <Settings /> : null;
    case 'offline':
      return <Offline onRetry={() => navigate(hasToken ? paths.kbs() : paths.connect(), { replace: true })} />;
    case 'connect':
    default:
      return hasToken ? null : <Connect reason={reason} />;
  }
}

function ConfigProblem({ message }: { message: string }) {
  const { t } = useLanguage();
  return (
    <main className="app-shell">
      <div className="flex flex-1 flex-col justify-center px-6">
        <h1 className="font-display text-2xl font-semibold">{t('app.name')}</h1>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{message}</pre>
      </div>
    </main>
  );
}

export function App() {
  let problem: string | null = null;
  try {
    config();
  } catch (e) {
    problem = e instanceof ConfigError ? e.message : String(e);
  }
  return (
    <LanguageProvider>
      <ToastProvider>
        {problem ? (
          <ConfigProblem message={problem} />
        ) : (
          <>
            <Router />
            <UpdateToast />
          </>
        )}
      </ToastProvider>
    </LanguageProvider>
  );
}

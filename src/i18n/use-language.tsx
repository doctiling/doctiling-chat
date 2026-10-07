import * as React from 'react';
import { translate, type Language } from './index';

// The language is the host's locale (the studio decides it by URL segment); the
// package never detects it from the browser. Switching = navigating to the
// same route under the other locale (Settings).
type Ctx = {
  language: Language;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const LanguageContext = React.createContext<Ctx | null>(null);

export function LanguageProvider({ children, language }: { children: React.ReactNode; language: Language }) {
  const value = React.useMemo<Ctx>(() => ({ language, t: (key, values) => translate(language, key, values) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage outside <LanguageProvider>');
  return ctx;
}

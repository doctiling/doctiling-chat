import * as React from 'react';
import { detectLanguage, translate } from './index';
import { getPrefs, setPrefs, type Language } from '@/lib/storage';

type Ctx = {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const LanguageContext = React.createContext<Ctx | null>(null);

function initialLanguage(): Language {
  const saved = getPrefs().language;
  if (saved === 'en' || saved === 'es') return saved;
  return detectLanguage(typeof navigator !== 'undefined' ? navigator.language : undefined);
}

export function LanguageProvider({ children, initial }: { children: React.ReactNode; initial?: Language }) {
  const [language, setLang] = React.useState<Language>(() => initial ?? initialLanguage());
  const setLanguage = React.useCallback((l: Language) => {
    setLang(l);
    setPrefs({ language: l });
  }, []);
  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = React.useMemo<Ctx>(
    () => ({ language, setLanguage, t: (key, values) => translate(language, key, values) }),
    [language, setLanguage],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage outside <LanguageProvider>');
  return ctx;
}

// Runtime configuration. In the image, server/serve.mjs injects
// window.__DOCTILING_CHAT__ into index.html; in `vite dev` the Vite env var is
// the fallback. The app never hard-codes a tenant.

export type ChatConfig = {
  /** Origin of the tenant's studio, e.g. https://studio.acme.com (no trailing slash). */
  apiOrigin: string;
  /** Host this chat is served from, e.g. chat.acme.com. */
  chatHost: string;
  /** package.json version, shown in Settings and reported by /health. */
  version: string;
};

declare global {
  interface Window {
    __DOCTILING_CHAT__?: Partial<ChatConfig>;
  }
}

export class ConfigError extends Error {
  constructor() {
    super(
      'Doctiling Chat has no API origin. Run the image with DOCTILING_API_ORIGIN=<studio origin>, or in dev set VITE_DOCTILING_API_ORIGIN.',
    );
    this.name = 'ConfigError';
  }
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

export function readConfig(): ChatConfig {
  const injected = typeof window !== 'undefined' ? window.__DOCTILING_CHAT__ : undefined;
  const envOrigin = (import.meta.env?.VITE_DOCTILING_API_ORIGIN as string | undefined) ?? '';
  const apiOrigin = trimSlash(injected?.apiOrigin ?? envOrigin ?? '');
  if (!apiOrigin) throw new ConfigError();
  const chatHost = injected?.chatHost || (typeof window !== 'undefined' ? window.location.host : '');
  const version = injected?.version || (import.meta.env?.VITE_APP_VERSION as string | undefined) || 'dev';
  return { apiOrigin, chatHost, version };
}

let cached: ChatConfig | null = null;

export function config(): ChatConfig {
  if (!cached) cached = readConfig();
  return cached;
}

/** Tests only: forget the cached config. */
export function resetConfigForTests() {
  cached = null;
}

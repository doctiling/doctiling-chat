import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, readConfig, resetConfigForTests, config } from '@/config';

// T054 — runtime config: injected by server/serve.mjs, Vite env in dev, clear error otherwise.
describe('config (T054)', () => {
  afterEach(() => {
    resetConfigForTests();
    vi.unstubAllEnvs();
  });

  it('reads window.__DOCTILING_CHAT__ and trims the trailing slash', () => {
    window.__DOCTILING_CHAT__ = { apiOrigin: 'https://studio.acme.test/', chatHost: 'chat.acme.test', version: '1.2.3' };
    expect(readConfig()).toEqual({ apiOrigin: 'https://studio.acme.test', chatHost: 'chat.acme.test', version: '1.2.3' });
  });

  it('falls back to VITE_DOCTILING_API_ORIGIN and window.location.host in dev', () => {
    vi.stubEnv('VITE_DOCTILING_API_ORIGIN', 'http://localhost:3100');
    const cfg = readConfig();
    expect(cfg.apiOrigin).toBe('http://localhost:3100');
    expect(cfg.chatHost).toBe(window.location.host);
    expect(cfg.version).toBe('dev');
  });

  it('throws a ConfigError naming both variables when nothing is configured', () => {
    vi.stubEnv('VITE_DOCTILING_API_ORIGIN', '');
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow(/DOCTILING_API_ORIGIN/);
    expect(() => readConfig()).toThrow(/VITE_DOCTILING_API_ORIGIN/);
  });

  it('caches the config until reset', () => {
    window.__DOCTILING_CHAT__ = { apiOrigin: 'https://a.test', version: '1' };
    expect(config().apiOrigin).toBe('https://a.test');
    window.__DOCTILING_CHAT__ = { apiOrigin: 'https://b.test', version: '2' };
    expect(config().apiOrigin).toBe('https://a.test');
    resetConfigForTests();
    expect(config().apiOrigin).toBe('https://b.test');
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, injectConfig, readRuntimeConfig, securityHeaders } from '../../server/serve.mjs';

const root = path.resolve(__dirname, '../..');
const pkgVersion = (await import('../../package.json')).default.version as string;

// T052 — static server: config injection, /health, CSP, no-store for sw.js, SPA fallback, exit 1 without origin. [TS-402, TS-413]
describe('server/serve.mjs (T052)', () => {
  let dist: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    dist = mkdtempSync(path.join(os.tmpdir(), 'chat-dist-'));
    mkdirSync(path.join(dist, 'assets'));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><script id="doctiling-chat-config">/*__DOCTILING_CHAT_CONFIG__*/</script></head><body></body></html>');
    writeFileSync(path.join(dist, 'sw.js'), "const VERSION = '__SW_VERSION__';");
    writeFileSync(path.join(dist, 'assets', 'app-abc.js'), 'console.log(1)');
    writeFileSync(path.join(dist, 'manifest.webmanifest'), '{}');
    const cfg = readRuntimeConfig({ DOCTILING_API_ORIGIN: 'https://studio.tenant.test/', DOCTILING_CHAT_HOST: 'chat.tenant.test', DOCTILING_DIST: dist, PORT: '0' });
    server = createServer(createApp(cfg));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const addr = server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    rmSync(dist, { recursive: true, force: true });
  });

  it('readRuntimeConfig requires a clean origin and reads the package version', () => {
    expect(() => readRuntimeConfig({})).toThrow(/DOCTILING_API_ORIGIN is required/);
    expect(() => readRuntimeConfig({ DOCTILING_API_ORIGIN: 'not a url' })).toThrow(/not a valid origin/);
    expect(() => readRuntimeConfig({ DOCTILING_API_ORIGIN: 'https://x.test/path' })).toThrow(/without path/);
    const cfg = readRuntimeConfig({ DOCTILING_API_ORIGIN: 'https://x.test/' });
    expect(cfg).toMatchObject({ apiOrigin: 'https://x.test', chatHost: '', version: pkgVersion, port: 8080 });
  });

  it('the process exits 1 without DOCTILING_API_ORIGIN (TS-413)', () => {
    const res = spawnSync(process.execPath, [path.join(root, 'server/serve.mjs')], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/DOCTILING_API_ORIGIN is required/);
  });

  it('injects window.__DOCTILING_CHAT__ into index.html and escapes <', () => {
    const html = injectConfig('<head><script id="doctiling-chat-config"></script></head>', { apiOrigin: 'https://a.test', chatHost: '</script><b>', version: '1' });
    expect(html).toContain('window.__DOCTILING_CHAT__={"apiOrigin":"https://a.test","chatHost":"\\u003c/script>\\u003cb>","version":"1"}');
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it('GET / serves the shell with the config, the CSP and no X-Powered-By (TS-402)', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`window.__DOCTILING_CHAT__={"apiOrigin":"https://studio.tenant.test","chatHost":"chat.tenant.test","version":"${pkgVersion}"}`);
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://studio.tenant.test");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(securityHeaders('https://o.test')['Content-Security-Policy']).toContain('https://o.test');
  });

  it('GET /health → {status, version} (TS-413)', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: pkgVersion });
  });

  it('/sw.js is no-store with the version stamped in', async () => {
    const res = await fetch(`${base}/sw.js`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe(`const VERSION = '${pkgVersion}';`);
  });

  it('hashed assets are immutable, app routes fall back to index.html, /api/* is 404 here', async () => {
    const asset = await fetch(`${base}/assets/app-abc.js`);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(asset.headers.get('content-type')).toContain('javascript');
    const route = await fetch(`${base}/kb/some-id/doc/x`);
    expect(route.status).toBe(200);
    expect(await route.text()).toContain('__DOCTILING_CHAT__');
    const api = await fetch(`${base}/api/chat/me`);
    expect(api.status).toBe(404);
    const traversal = await fetch(`${base}/..%2F..%2Fpackage.json`);
    expect(await traversal.text()).toContain('__DOCTILING_CHAT__');
  });
});

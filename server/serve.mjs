// Static server of the image (plan § C): serves dist/, injects the runtime
// config into index.html, answers /health, sets the security headers. No
// dependencies: Node 20 only. Configuration by environment:
//   DOCTILING_API_ORIGIN  required  origin of the tenant's studio (https://studio.acme.com)
//   DOCTILING_CHAT_HOST   optional  host this chat is published on (chat.acme.com)
//   PORT                  optional  default 8080
//   DOCTILING_DIST        optional  build directory, default <repo>/dist (tests)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readRuntimeConfig(env = process.env) {
  const apiOrigin = (env.DOCTILING_API_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!apiOrigin) {
    throw new Error('DOCTILING_API_ORIGIN is required (origin of the tenant studio, e.g. https://studio.acme.com)');
  }
  let parsed;
  try {
    parsed = new URL(apiOrigin);
  } catch {
    throw new Error(`DOCTILING_API_ORIGIN is not a valid origin: ${apiOrigin}`);
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`DOCTILING_API_ORIGIN must be an origin without path: ${apiOrigin}`);
  }
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  return {
    apiOrigin: parsed.origin,
    chatHost: (env.DOCTILING_CHAT_HOST ?? '').trim(),
    version,
    port: Number(env.PORT ?? 8080),
    dist: path.resolve(root, env.DOCTILING_DIST ?? 'dist'),
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

export function securityHeaders(apiOrigin) {
  return {
    'Content-Security-Policy': `default-src 'self'; connect-src 'self' ${apiOrigin}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

const escapeForScript = (json) => json.replace(/</g, '\\u003c');

export function injectConfig(html, cfg) {
  const payload = escapeForScript(JSON.stringify({ apiOrigin: cfg.apiOrigin, chatHost: cfg.chatHost, version: cfg.version }));
  const script = `<script id="doctiling-chat-config">window.__DOCTILING_CHAT__=${payload}</script>`;
  const re = /<script id="doctiling-chat-config">[\s\S]*?<\/script>/;
  if (re.test(html)) return html.replace(re, script);
  return html.replace('</head>', `${script}\n</head>`);
}

export function createApp(cfg) {
  const indexPath = path.join(cfg.dist, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`no build at ${cfg.dist} (run npm run build)`);
  const indexHtml = injectConfig(readFileSync(indexPath, 'utf8'), cfg);
  const swPath = path.join(cfg.dist, 'sw.js');
  const swJs = existsSync(swPath) ? readFileSync(swPath, 'utf8').replace(/__SW_VERSION__/g, cfg.version) : null;
  const headers = securityHeaders(cfg.apiOrigin);

  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (status, body, type, extra = {}) => {
      res.writeHead(status, { ...headers, 'Content-Type': type, ...extra });
      res.end(body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed', MIME['.txt']);
    if (url.pathname === '/health') {
      return send(200, JSON.stringify({ status: 'ok', version: cfg.version }), MIME['.json'], { 'Cache-Control': 'no-store' });
    }
    if (url.pathname === '/sw.js') {
      if (!swJs) return send(404, 'not found', MIME['.txt']);
      return send(200, swJs, MIME['.js'], { 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return send(200, indexHtml, MIME['.html'], { 'Cache-Control': 'no-cache' });
    }
    // Static files from dist (never above it).
    const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(cfg.dist, rel);
    if (file.startsWith(cfg.dist) && existsSync(file) && statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      const immutable = rel.startsWith(`${path.sep}assets${path.sep}`) || rel.startsWith('/assets/');
      return send(200, readFileSync(file), MIME[ext] ?? 'application/octet-stream', {
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      });
    }
    // SPA fallback: unknown paths (routes) get the shell. /api/* never lives here.
    if (url.pathname.startsWith('/api/')) return send(404, JSON.stringify({ error: 'not_found' }), MIME['.json']);
    return send(200, indexHtml, MIME['.html'], { 'Cache-Control': 'no-cache' });
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let cfg;
  try {
    cfg = readRuntimeConfig();
  } catch (e) {
    console.error(`doctiling-chat: ${e.message}`);
    process.exit(1);
  }
  let handler;
  try {
    handler = createApp(cfg);
  } catch (e) {
    console.error(`doctiling-chat: ${e.message}`);
    process.exit(1);
  }
  const server = createServer(handler);
  server.listen(cfg.port, () => {
    console.info(`doctiling-chat ${cfg.version} on :${cfg.port} → api ${cfg.apiOrigin}${cfg.chatHost ? ` (host ${cfg.chatHost})` : ''}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

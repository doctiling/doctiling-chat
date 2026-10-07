# Doctiling Chat

Mobile-first, installable chat for the people of a Doctiling tenant. It is a **pure client** of the tenant's
studio API (`/api/chat/*`, doctiling-web spec 045): the person connects with the account they already have in
the studio, sees only the knowledge bases shared with them, and talks to the same agent with the same
permissions, confirmation gate and quota. Nothing of business is stored on the phone.

## Run it locally

Against a doctiling-web running on `http://localhost:3100` with `DOCTILING_CHAT_HOST=localhost:5173`:

```sh
npm install
VITE_DOCTILING_API_ORIGIN=http://localhost:3100 npm run dev -- --port 5173 --strictPort
```

Open <http://localhost:5173>, tap **Connect**: the studio asks you to sign in (or confirms your session), you
confirm, and you are back in the chat identified. The dev server does not register the service worker.

## Run the image

```sh
npm run build
DOCTILING_API_ORIGIN=https://studio.acme.com DOCTILING_CHAT_HOST=chat.acme.com node server/serve.mjs
# or
docker build -t doctiling-chat .
docker run -p 8080:8080 -e DOCTILING_API_ORIGIN=https://studio.acme.com -e DOCTILING_CHAT_HOST=chat.acme.com doctiling-chat
```

| Variable | Required | Meaning |
|---|---|---|
| `DOCTILING_API_ORIGIN` | yes | Origin of the tenant's studio. The server exits 1 without it. |
| `DOCTILING_CHAT_HOST` | no | Host this chat is published on (shown to the person, used by the studio's CORS). |
| `PORT` | no | Default `8080`. |

`GET /health` → `{"status":"ok","version":"0.1.0"}`. The server injects `window.__DOCTILING_CHAT__`, sets a strict
CSP (`connect-src 'self' <apiOrigin>`, `frame-ancestors 'none'`), serves `/sw.js` with `Cache-Control: no-store`
and falls back to `index.html` for app routes.

Operators do not run this by hand: `doctiling tenant chat enable <tenant> --domain chat.<host>` (doctiling-cli)
creates the service with the published image `ghcr.io/doctiling/chat:<version>`.

## Develop

- `npm run gate` — the only verdict that counts (`scripts/gate.sh`). See `docs/harness/harness.md`.
- `npm test` — vitest + Testing Library; `tests/pwa/sw.test.ts` loads `public/sw.js` in a fake worker scope.
- `npm run icons` — regenerates `public/icons/*` from the brand tokens.
- Routes: `/` · `/connect` · `/connect/callback` · `/kb` · `/kb/:id` · `/kb/:id/doc/:docId` · `/settings` · `/offline`.
- Copy: `src/i18n/{en,es}.json`. Principles: `CONSTITUTION.md`. Debt: `DEBT.md`. Operations: `docs/runbook.md`.

## Release

Bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml` runs the gate and
publishes `ghcr.io/doctiling/chat:X.Y.Z` and `:latest`.

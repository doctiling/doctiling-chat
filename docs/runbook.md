# Runbook — doctiling-chat

## What runs where

One image (`ghcr.io/doctiling/chat:<version>`) for every tenant; `server/serve.mjs` serves `dist/` on `PORT`
(8080) and injects the tenant's configuration at start. The CLI (`doctiling tenant chat enable`) creates the
Railway service with `DOCTILING_API_ORIGIN=https://<studio host>`, `DOCTILING_CHAT_HOST=<chat host>`,
`PORT=8080`, `NODE_ENV=production`, and sets `DOCTILING_CHAT_HOST` on the tenant's **web** service, which is
what switches the API on.

## Health

- `GET https://<chat host>/health` → `{"status":"ok","version":"X.Y.Z"}`.
- `GET https://<studio host>/api/chat/me` without a token → `401 {"error":"invalid"}` means the API is on;
  `404` means `DOCTILING_CHAT_HOST` is not set on the web service.

## Symptoms

| Symptom | Likely cause | Check |
|---|---|---|
| Service exits at start | `DOCTILING_API_ORIGIN` missing or not an origin | service logs: `doctiling-chat: DOCTILING_API_ORIGIN is required` |
| "The chat is not enabled for this organisation" after Connect | web has no `DOCTILING_CHAT_HOST`, or it differs from the chat's host | `curl -i https://<studio>/api/chat/me` → 404 |
| Browser console: CORS error on `/api/chat/*` | `DOCTILING_CHAT_HOST` on web ≠ host the person opened | compare `Access-Control-Allow-Origin` with the page origin |
| Browser console: CSP `connect-src` violation | `DOCTILING_API_ORIGIN` of the chat service ≠ studio origin | `curl -I https://<chat>/` → `Content-Security-Policy` |
| Everyone signed out at once | web rotated `chat_host` (tokens are bound to it) or members were revoked | studio security log: `chat_disconnected` |
| "Update" toast never appears | `/sw.js` cached by a proxy | `curl -I https://<chat>/sw.js` → must be `Cache-Control: no-store` |
| iOS opens the callback in Safari, app still asks to connect | known iOS behaviour (plan § Risks) | tap "Open in the app" on the callback page, connect again from the installed app |

## Release

1. Bump `version` in `package.json` (same commit as the change). `npm run gate` green.
2. Tag `vX.Y.Z`, push the tag. `release.yml` runs the gate, builds, pushes `ghcr.io/doctiling/chat:X.Y.Z` + `:latest`, verifies the pull.
3. Roll a tenant: `doctiling tenant deploy <tenant> --chat` (pins the new image on the chat service).

## Rollback

`doctiling tenant deploy <tenant> --chat --image ghcr.io/doctiling/chat:<previous>`; the installed app offers
"Update" on next open and reloads without touching the token.

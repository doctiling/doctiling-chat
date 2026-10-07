# CLAUDE.md — doctiling-chat

Doctiling Chat (`@doctiling/chat`): mobile-first installable PWA, **pure client** of a tenant's `/api/chat/*`
(doctiling-web, spec 045). Vite + React 18 + TypeScript strict + Tailwind 3; manifest and `public/sw.js` by hand.

- **No business rules here.** Permission, role, quota, scope and the confirmation gate are decided by the
  server: the app renders 401/403/409 and the stream's `Error` events, never pre-decides. Any 401 → sign out.
  Nothing of business (conversation, bases, documents) is stored on the device; the SW never caches `/api/*`.
- **Runtime config**: `server/serve.mjs` injects `window.__DOCTILING_CHAT__` from `DOCTILING_API_ORIGIN`
  (required) and `DOCTILING_CHAT_HOST`. Dev: `VITE_DOCTILING_API_ORIGIN=http://localhost:3100 npm run dev`.
- **Copy** lives in `src/i18n/{en,es}.json`, both locales in the same change (`tests/lib/i18n.test.ts`).
  Vendor names never reach `src/` or `public/` (`scripts/white-label-guard.mjs`, BLOCKING).
- **Icon controls** use `<IconButton label=…>` (label = accessible name + tooltip); native `title=` is banned
  by eslint. Touch targets ≥ 44 px (`min-h-touch`).
- **Design tokens** come from `@doctiling/brand` (tarball pinned by tag); `@doctiling/ui` is not published,
  so the few atoms here are local (see `DEBT.md`). Never copy product code from doctiling-web.
- **API contract**: doctiling-web `specs/045-tenant-chat-pwa/contracts/chat-api.md`; types in `src/lib/api.ts`.
- **Gate (BLOCKING)**: `npm run gate`. Never weaken a check to go green.
- **Agent harness**: `docs/harness/harness.md`; principles in `CONSTITUTION.md`; verified state in `STATUS.md`;
  incidents in `docs/harness/gotchas.md` via `/lesson`. Install the pre-commit once per clone: `npm run hooks:install`.
- **Release**: bump `version`, tag `vX.Y.Z` → `.github/workflows/release.yml` publishes `ghcr.io/doctiling/chat`.

# CLAUDE.md — doctiling-chat

Doctiling Chat (`@doctiling/chat`): the tenant's mobile-first, installable chat as a **React package compiled
into the studio** (doctiling-web, spec 045 + plan amendment 2026-10-07). Raw TS, no build step; the host
transpiles it, exactly like `@doctiling/landing`. Pure client of `/api/chat/*`.

- **Host contract** is `ChatAppProps` (`src/ChatApp.tsx`): `basePath`, `locale`, `apiBase`, `signInHref`,
  `studioHref`, `signOutHref`, `version`. The chat never imports Next.js, `@/` or product code (eslint
  `no-restricted-imports`, BLOCKING). `./pwa` (`src/pwa.ts`) is pure: manifest, SW source, offline page.
- **No business rules here.** Permission, role, quota, scope and the confirmation gate are decided by the
  server: the app renders 403/409 and the stream's `Error` events, never pre-decides. The studio session is
  the session: **401 → `signInHref?callbackUrl=`**, bare **404 on `/api/chat/*` → "not enabled"** screen.
  Nothing of business is stored on the device (prefs only, `src/lib/storage.ts`); the SW never caches `/api/*`.
- **Copy** lives in `src/i18n/{en,es}.json`, both locales in the same change (`tests/lib/i18n.test.ts`).
  Vendor names never reach `src/` or `public/` (`scripts/white-label-guard.mjs`, BLOCKING).
- **Design system**: `@doctiling/ui` (Button, SimpleTooltip, Sheet parts) is a requirement of the host,
  resolved here through the `.ui` symlink (`scripts/link-ui.sh`). Only `IconButton`, `Sheet` (composition),
  `Toast` and the chat-specific pieces stay local. Icon controls: `<IconButton label=…>` (accessible name +
  tooltip); native `title=` is banned by eslint. Touch targets ≥ 44 px (`min-h-[44px]`).
- **Styling**: Tailwind classes of the `@doctiling/ui` preset (`text-muted-foreground`, `bg-card`…); the host
  compiles them (`content` glob) and imports `@doctiling/chat/styles.css` once (shell, prose, typing dots).
- **API contract**: doctiling-web `specs/045-tenant-chat-pwa/contracts/chat-api.md`; types in `src/lib/api.ts`.
- **Gate (BLOCKING)**: `npm run gate` (`node scripts/gate.mjs`, signals in `.claude/harness.config.json` →
  `gate.signals`). Never weaken a check to go green.
- **Agent harness**: [raalzate/agent-harness](https://github.com/raalzate/agent-harness) — this repo's harness in
  `docs/arnes.md`; principles in `CONSTITUTION.md`; verified state in `STATUS.md`; incidents in `docs/gotchas.md`
  via `/lesson`. Install the git hooks once per clone: `npm run hooks:install`. Generic hook/script files are
  byte-identical upstream copies: only `.claude/harness.config.json` is repo-specific.
- Commits that touch code reference an issue (`#N`) or carry a `no-issue: <why>` line (`.githooks/commit-msg`);
  branches are `type/what`; `main` only by PR (`.githooks/pre-push`).
- **Release**: bump `version`, tag `vX.Y.Z` (`release.yml` = gate + tag/version match); web bumps the pin.
- Public repo: nothing secret, no `.env`.

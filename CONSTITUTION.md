# Constitution — doctiling-chat

**Version 1.0.0** · Principles of the tenant chat PWA (spec 045 of doctiling-web).
Every principle states its strength: **BLOCKING** names the command that fails; otherwise it is **REVIEW**
(judged by the `reviewer` subagent and the human). Amendments bump the version, in their own commit.

## P1 — White label: no AI vendor name reaches the person · BLOCKING

The chat is a client of whatever model the tenant runs and never says which. Copy, error messages, activity
labels, manifest, offline page, icons.

*Mechanism:* `node scripts/white-label-guard.mjs` in the gate, over everything under `src/` and `public/`.

## P2 — Both locales, same keys · BLOCKING

`src/i18n/en.json` and `src/i18n/es.json` expose the same key set, in the same change. Screens never carry a
literal string a person reads.

*Mechanism:* `tests/lib/i18n.test.ts` (parity, fails on one missing key) in `npm test`.

## P3 — Every icon control has a label and a tooltip · BLOCKING

`<IconButton label=…>` is the only way to render an icon-only control; the label is the accessible name and
the tooltip. Native `title=` is not a tooltip. Touch targets are 44 px or more.

*Mechanism:* `npm run lint` (`no-restricted-syntax`: `title=` in JSX, `<IconButton>` without `label`) and
`tests/components/icon-button.test.tsx`.

## P4 — TDD: red first · REVIEW

Every piece lands with its failing test first (`tests/`), named with the `TS-xxx` scenario it serves.

## P5 — Assertion integrity · REVIEW

An assertion is never adjusted to make a test pass; `.feature` files of the spec are never edited here.

## P6 — No double submit · REVIEW

Send, confirm, reject, clear and sign out are guarded by a ref: a double tap produces one request
(`tests/screens/Conversation.lock.test.tsx`).

## P7 — The client holds no business rules · REVIEW

Permission, role, quota, scope, lock and the confirmation gate are decided by the server on every request.
The app renders 401 (→ sign out), 403, 409 and the stream's `Error` events. Nothing of business is stored on
the device; the service worker never caches `/api/*`, `/connect/*` or a request with `Authorization`
(`tests/pwa/sw.test.ts`).

## P8 — Nothing ships without a green gate · BLOCKING

*Mechanism:* `npm run gate` (`scripts/gate.sh`: harness self-test · docs link-check · white-label guard ·
lint · typecheck · tests · build), the `Stop` hook, and `.github/workflows/gate.yml` on every push, PR and
`v*` tag; `release.yml` runs the gate before publishing the image.

## P9 — Conduct on error · REVIEW

Read the real output before retrying; after 2 failed attempts on the same error, stop and escalate.

# @doctiling/chat

The mobile-first, installable chat for the people of a Doctiling tenant, as a **React package the studio
compiles in** (doctiling-web, spec 045). It is a **pure client** of the tenant's `/api/chat/*`: the studio
session is the chat session (same origin, same cookie), the person sees only the knowledge bases shared
with them and talks to the same agent with the same permissions, confirmation gate and quota. Nothing of
business is stored on the phone. Raw TypeScript, no build step; the host transpiles it.

It replaces the first design (own subdomain, own Railway service, token hand-off): the chat is now served
by the tenant's studio at `/{locale}/chat` and switched on per tenant with `DOCTILING_CHAT_ENABLED=true`.

## Consume (doctiling-web)

Pin a tag through the HTTPS tarball, like `@doctiling/landing`:

```sh
npx -y npm@10.8.2 install @doctiling/chat@https://codeload.github.com/doctiling/doctiling-chat/tar.gz/refs/tags/v0.4.0
```

Then, in web:

1. `transpilePackages: ['@doctiling/chat']` in `next.config.ts`.
2. Tailwind `content`: `./node_modules/@doctiling/chat/src/**/*.{ts,tsx}` (the classes are the
   `@doctiling/ui` preset's; without the glob they are purged).
3. Import `@doctiling/chat/styles.css` once, in the `(chat)` layout.
4. Mount the app on every path under the base (client page, `[[...path]]`):

```tsx
import { ChatApp } from '@doctiling/chat';

<ChatApp
  basePath={`/${locale}/chat`}
  locale={locale}
  signInHref={`/${locale}/signin`}
  studioHref={`/${locale}/kb`}
  signOutHref={`/${locale}/auth/signout`}
  version={chatVersion}
/>
```

5. PWA routes from `@doctiling/chat/pwa` (pure, no DOM):
   - `GET /{locale}/chat/manifest.webmanifest` → `manifestFor(locale, { startUrl, scope, iconsBase })`
   - `GET /{locale}/chat/sw.js` → `serviceWorkerSource({ scope, offlineUrl, version, precache })`
     (serve with `Cache-Control: no-store`)
   - `GET /{locale}/chat/offline.html` → `offlineHtml(locale)`
   - copy `@doctiling/chat/public/icons/*` to `public/chat/icons/` (doctiling-web `scripts/chat-assets.mjs`, like the landing). <!-- linkcheck:ignore — path in doctiling-web -->
   The `(chat)` layout adds `<link rel="manifest">`; `ChatApp` itself registers `${basePath}/sw.js` with
   scope `${basePath}/`.

`ChatAppProps` (`src/ChatApp.tsx`) is the whole contract: the chat never imports the host. On **401** it
navigates to `signInHref?callbackUrl=<current path>`; on a bare **404** from `/api/chat/*` it shows
"the chat is not enabled here" with a link to `studioHref`; "Sign out" is a link to `signOutHref`.

### Peer dependencies

`react`, `react-dom` and `lucide-react` are declared peers. `@doctiling/ui` (atoms, molecules) is a
raw-TS workspace package inside the private `doctiling-web` repo and is a **requirement of the host, not a
declared peer**: an unpublished package in `peerDependencies` makes npm reshuffle the consumer's workspace
link on every install. This repo's own typecheck and tests resolve it through a `.ui` symlink to a web
checkout (`scripts/link-ui.sh`, `../web/packages/ui` by default; `DOCTILING_UI_DIR` in CI, where a sparse
checkout needs the `WEB_READ_TOKEN` secret). The Radix packages the design system needs come with the host.

## Develop

```
npm install
npm run gate        # harness self-test · docs link-check · link @doctiling/ui · white-label guard · lint · typecheck · tests
npm run icons       # regenerates public/icons/* from the brand tokens
```

- Routes under `basePath`: `/` · `/kb` · `/kb/:id` · `/kb/:id/docs` · `/kb/:id/doc/:docId` · `/settings` · `/offline`.
- Documents of the open base (`GET …/documents`, only what the person may read) in `src/screens/Documents.tsx`
  (mobile screen / desktop side panel), cached once per base and reused by the composer's `@` mention picker,
  which sends `referencedDocumentIds` next to `query` (max 10). A read-only base (`session.access.canWrite ===
  false`) shows a "Read-only" badge in the conversation header; the server decides, the chat only shows it.
- Responsive by **viewport size, never user agent**: below Tailwind `md` (768 px) the stacked mobile
  navigation (one screen, bottom composer, bottom sheets); from 768 px a two-column desktop shell (base list
  320 px + conversation/settings, source as a side panel, Enter sends) — `src/lib/media.ts`, `md:` classes.
- Copy: `src/i18n/{en,es}.json`. Principles: `CONSTITUTION.md`. Debt: `DEBT.md`. Operations: `docs/runbook.md`.
- Tests: vitest + Testing Library; `tests/pwa.test.ts` runs the generated worker in a fake worker scope.

## Release

Bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml` runs the gate
and checks the tag matches the version; web then bumps its pin. No image, no registry.

License: see `LICENSE` (public source, not open-licensed).

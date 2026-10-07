# DEBT — doctiling-chat

Declared debt, each with the condition that retires it.

- **`@doctiling/ui` is not published.** The design system lives in doctiling-web `packages/ui` (private).
  This repo carries minimal local atoms (`Button`, `IconButton`, `Tooltip`, `Sheet`, `Toast`) styled with the
  `@doctiling/brand` tokens. Retire when `@doctiling/ui` ships as its own public package pinned by tag (plan
  045 § Risks): replace the atoms, delete `src/components/{Button,IconButton,Tooltip,Sheet,Toast}.tsx`.
- **No attachments.** The chat sends `query` or `resume` only; the API answers 400 `attachments_not_supported`
  (FR, plan P8). Out of scope of 045.
- **No push notifications.** The studio's web push is not wired into the chat (plan P8). A pending
  confirmation is only visible when the app is open.
- **Automatic reconnection.** A dropped stream shows a notice and the person retries (FR-023). No resume.
- **Markdown renderer is minimal** (`src/lib/markdown.ts`): headings, lists, code, quotes, tables, inline
  marks and links. No images, no nested lists, no HTML. Enough for agent replies and reading view; revisit if
  documents render poorly.
- **Service worker precache is static.** Hashed Vite assets are cached on first use (cache-first), not at
  install; the first offline open after an update may miss a chunk until it was visited online once.
- **Lighthouse / real-device measurements** (SC-001, SC-004, SC-008) pending phase 10.

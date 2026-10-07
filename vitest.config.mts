import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `.ui` is a symlink to the design-system source of the doctiling-web checkout
// (scripts/link-ui.sh); tsconfig.json maps the same alias for the typecheck.
const ui = fileURLToPath(new URL('./.ui/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@doctiling\/ui\/(.*)$/, replacement: `${ui}/$1` }],
    // Keep the symlink path: the linked design system then resolves React,
    // Radix and lucide from THIS repo's node_modules (what package.json
    // declares), not from the web checkout — two Reacts make every hook throw.
    preserveSymlinks: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 10_000,
  },
});

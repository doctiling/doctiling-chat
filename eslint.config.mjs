// Constitution P3 (tooltip/label on icon controls) and P7 (host-agnostic) are
// enforced here, not in review: a native `title=` never reaches JSX, every
// <IconButton> declares `label`, and nothing under src/ imports Next.js or
// the host's `@/` alias (the package is compiled inside doctiling-web, where
// `@/` would silently resolve to product code).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'public/**', 'coverage/**', '.ui/**', 'web/**', '*.cjs'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Generic agent-harness file, byte-identical to upstream (harness drift fails on any local
    // edit): its comma-expression statements are upstream's style, not this repo's to fix.
    files: ['scripts/library.mjs'],
    rules: { '@typescript-eslint/no-unused-expressions': 'off' },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['next', 'next/*'], message: 'The chat never imports Next.js: it is a host-agnostic React package (CONSTITUTION P7).' },
            { group: ['@/*'], message: 'No `@/` alias here: inside the host it would resolve to product code (CONSTITUTION P7). Use a relative import.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="title"]',
          message:
            'Native title= is not a tooltip (CONSTITUTION P3): use <SimpleTooltip label=…> or <IconButton label=…>.',
        },
        {
          selector: 'JSXOpeningElement[name.name="IconButton"]:not(:has(JSXAttribute[name.name="label"]))',
          message: '<IconButton> needs a `label` (accessible name + tooltip), CONSTITUTION P3.',
        },
      ],
    },
  },
);

// Constitution P3 (tooltip/label on icon controls) is enforced here, not in review:
// a native `title=` never reaches JSX, and every <IconButton> declares `label`.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**', '*.cjs'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
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
            'Native title= is not a tooltip (CONSTITUTION P3): use <Tooltip label=…> or <IconButton label=…>.',
        },
        {
          selector: 'JSXOpeningElement[name.name="IconButton"]:not(:has(JSXAttribute[name.name="label"]))',
          message: '<IconButton> needs a `label` (accessible name + tooltip), CONSTITUTION P3.',
        },
      ],
    },
  },
);

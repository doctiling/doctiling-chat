import type { Config } from 'tailwindcss';
import { lightColors, darkColors, radius, typography } from '@doctiling/brand';

// Tailwind preset derived from the brand tokens: every color below is a CSS
// variable set in src/styles.css from the same tokens, so dark mode is a
// variable swap and the palette cannot drift from @doctiling/brand.
const semantic = Object.keys(lightColors) as Array<keyof typeof lightColors>;
const colorVars = Object.fromEntries(semantic.map((k) => [k, `var(--color-${k})`]));

// Exported for src/styles.css generation at build time (see scripts/make-icons.mjs
// for the Node-side read) and for tests that assert the theme-color.
export const brandTheme = { light: lightColors, dark: darkColors };

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: colorVars,
      fontFamily: {
        display: [typography.display, 'Georgia', 'serif'],
        body: [typography.body, 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
} satisfies Config;

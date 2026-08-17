import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * RTL enforcement (brief §3, rule 1).
 *
 * The app is `dir="rtl"`. Physical CSS utilities (`ml-*`, `pr-*`, `left-*`,
 * `border-l-*`, `text-left`, …) do not mirror and silently produce a
 * left-to-right layout inside a right-to-left page. Tailwind v4 ships logical
 * equivalents natively (`ms-* me-* ps-* pe-* start-* end-* border-s border-e
 * rounded-s/e text-start text-end`), so there is never a reason to use the
 * physical ones.
 *
 * `space-x-*` and `divide-x-*` are banned outright: they emit `margin-left` /
 * `border-left-width` with a reverse variable and are genuinely broken under
 * RTL. Use `gap-*` instead.
 *
 * Enforced on both plain string literals and template-literal chunks, which is
 * where `cn()` / `clsx()` class strings live.
 */
const PHYSICAL_UTILITIES = String.raw`(^|[\s'"\x60])-?(m[lr]|p[lr]|space-x|divide-x|scroll-m[lr]|inset-[lr])-|(^|[\s'"\x60])(left|right)-[0-9a-z]|border-[lr]-|rounded-([tb])?[lr]-|text-(left|right)|float-(left|right)|clear-(left|right)|origin-(left|right)`;

const RTL_MESSAGE =
  'RTL: physical utility detected. Use logical properties (ms-/me-/ps-/pe-/start-/end-/border-s/border-e/rounded-s/rounded-e/text-start/text-end) and gap-* instead of space-x-*/divide-x-*.';

const rtlRules = {
  'no-restricted-syntax': [
    'error',
    { selector: `Literal[value=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
    { selector: `TemplateElement[value.raw=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'supabase/**',
      // generated — regenerate with `npm run gen:types`
      'src/types/database.types.ts',
    ],
  },

  // Application source — type-checked
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      // `.flat` matters: configs['recommended-latest'] is still the legacy
      // eslintrc shape (plugins as an array of strings) and ESLint 10 rejects it.
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...rtlRules,
      // Brief rule 5: no `any`, no non-null assertions on Supabase results.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // Tests may use non-null assertions on fixtures.
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // Node-side config files — not type-checked against the app project.
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  prettier,
);

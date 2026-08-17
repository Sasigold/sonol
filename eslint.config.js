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

/**
 * Copy discipline (brief §3, rule 3).
 *
 * Every user-visible string comes from src/lib/copy.ts — no literal in JSX,
 * ever. Without a rule that is only a convention, and phase 1 shipped a page
 * that broke it. The Hebrew block is U+0590–U+05FF; matching on script rather
 * than on a word list catches every new string automatically.
 *
 * Only JSX nodes are matched, so copy.ts's own plain string literals and the
 * Hebrew inside test assertions are unaffected.
 */
const HEBREW = String.raw`[֐-׿]`;

const COPY_MESSAGE =
  'Hebrew literal in JSX. Every user-visible string belongs in src/lib/copy.ts — import it instead.';

const rtlRules = {
  'no-restricted-syntax': [
    'error',
    { selector: `Literal[value=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
    { selector: `TemplateElement[value.raw=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
    { selector: `JSXText[value=/${HEBREW}/]`, message: COPY_MESSAGE },
    { selector: `JSXAttribute Literal[value=/${HEBREW}/]`, message: COPY_MESSAGE },
    { selector: `JSXExpressionContainer > Literal[value=/${HEBREW}/]`, message: COPY_MESSAGE },
    {
      selector: `JSXExpressionContainer TemplateElement[value.raw=/${HEBREW}/]`,
      message: COPY_MESSAGE,
    },
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

  // Tests may use non-null assertions on fixtures, and Hebrew literals as
  // fixture data — a test is not user-facing UI, so the copy rule does not
  // apply. The RTL rules still do.
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
        { selector: `TemplateElement[value.raw=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
      ],
    },
  },

  // UI primitives and the router intentionally export variants, sub-components
  // and the router object alongside components. Fast Refresh granularity is not
  // worth splitting a 20-line primitive across three files.
  {
    files: ['src/components/ui/**/*.tsx', 'src/router.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Node-side config files — not type-checked against the app project.
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  /*
   * Playwright specs.
   *
   * They need their own block: `e2e/**` sits outside the `src/**` glob above,
   * so without this ESLint parses it with no config at all. Type-aware linting
   * is on (they are covered by tsconfig.node.json), but the copy rule is not —
   * a spec asserts on Hebrew text, which is the whole point of it.
   */
  {
    files: ['e2e/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
        { selector: `TemplateElement[value.raw=/${PHYSICAL_UTILITIES}/]`, message: RTL_MESSAGE },
      ],
    },
  },

  prettier,
);

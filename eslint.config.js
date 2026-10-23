// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist/**',
    '.vercel/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
    'submission-kit/**',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    name: 'mehfil/typescript',
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='zod'][importKind!='type'] > ImportSpecifier[imported.name='z'][importKind!='type']",
          message:
            "Use `import * as z from 'zod'`: with the named import, esbuild keeps all of zod's locales (about 250 KB).",
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },

  {
    name: 'mehfil/client',
    files: ['src/client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.configs.strict],
    languageOptions: { globals: globals.browser },
  },

  {
    name: 'mehfil/node',
    files: [
      'src/server/**/*.ts',
      'scripts/**/*.{ts,mjs}',
      'evals/**/*.ts',
      'e2e/**/*.ts',
      'tests/**/*.ts',
      '*.config.{ts,js}',
    ],
    languageOptions: { globals: globals.node },
  },

  {
    name: 'mehfil/cli-scripts',
    files: ['scripts/**/*.{ts,mjs}', 'evals/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    name: 'mehfil/tests',
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'tests/**/*.ts', 'src/client/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    name: 'mehfil/plain-js',
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    name: 'mehfil/browser-scripts',
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
]);

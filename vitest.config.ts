import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Two test projects share one config:
 *  - `node`: pure domain logic (src/shared), the AI gateway (src/server) and build scripts.
 *  - `dom`:  React components and client services under jsdom.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['src/shared/**/*.test.ts', 'src/server/**/*.test.ts', 'scripts/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/client/**/*.test.{ts,tsx}'],
            // These need the Firebase emulators: see vitest.rules.config.ts.
            exclude: [...configDefaults.exclude, 'src/client/**/*.emulator.test.ts'],
            setupFiles: ['./src/client/test/setup.ts'],
            // CSS is stubbed in tests, except the tokens file the contrast test reads.
            css: { include: [/tokens\.css/] },
            // Full-page axe scans of the SVG-rich pages are slow in jsdom, more so with coverage.
            testTimeout: 20_000,
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.d.ts',
          'src/client/test/**',
          'src/shared/test/**',
          'src/client/main.tsx',
          // Tested against the Firebase emulators instead (npm run test:rules).
          'src/client/cloud/firebase.ts',
          'src/server/node.ts',
          'src/server/vercel.ts',
        ],
        reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
        thresholds: {
          'src/shared/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
          'src/server/**': { lines: 90, branches: 85, functions: 90, statements: 90 },
          'src/client/**': { lines: 80, branches: 75, functions: 75, statements: 80 },
        },
      },
    },
  }),
);

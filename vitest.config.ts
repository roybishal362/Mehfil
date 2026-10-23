import { defineConfig, mergeConfig } from 'vitest/config';
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
            setupFiles: ['./src/client/test/setup.ts'],
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

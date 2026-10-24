import { defineConfig, devices } from '@playwright/test';

const PORT = 4319;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against the production build served by the Node entry,
 * with the deterministic mock AI provider so results are stable and free.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Each test drives a full browser and runs axe scans; a few at a time keeps them steady.
  workers: isCI ? 2 : 3,
  timeout: 60_000,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node dist/server/node.mjs',
    url: `http://localhost:${String(PORT)}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      AI_PROVIDER: 'mock',
      // Every test runs from the same address; the production limit is far lower.
      AI_RATE_LIMIT: '10000',
      NODE_ENV: 'production',
      MEHFIL_DISABLE_ENV_FILE: '1',
    },
  },
});

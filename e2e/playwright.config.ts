import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real API through the web build of the app.
 * Start first: Postgres, `pnpm dev:api`, `pnpm --filter mobile web` (see e2e/README.md).
 */
export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    channel: 'chrome', // the installed Chrome; no browser download
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

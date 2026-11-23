import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://lc:lc@localhost:5433/landconnect_test',
      RING_TIMEOUT_MS: '600',
    },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 15_000,
  },
});

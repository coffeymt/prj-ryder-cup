import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  testMatch: ['**/*.e2e.{ts,js}', 'e2e/**/*.spec.ts', 'tests/**/*.spec.ts'],
  use: {
    baseURL: 'https://golf.sbcctears.com',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

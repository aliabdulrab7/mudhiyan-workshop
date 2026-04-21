// Playwright config for the bulk-scan e2e suite.
//
// Assumes both dev servers are already running (npm run dev) — the suite is
// designed to be run against the live app + real SQLite dev DB, not a
// throwaway server. This matches the QA protocol: the same DB the user sees.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect:  { timeout: 10_000 },
  fullyParallel: false,      // tests seed/clean the same DB
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true, // vite dev cert
    trace: 'retain-on-failure',
    video: 'off',
    locale: 'ar',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

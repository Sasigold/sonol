import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration for the two flows in §12.
 *
 * ⚠️  These specs WRITE to whatever Supabase project `.env` points at. The
 * admin flow calls `reset_round`, which clears every completion and zeroes
 * every counter in the database — irreversibly, for every user. They are
 * therefore gated behind `E2E_ALLOW_WRITES=1` and refuse to start without it.
 * Point them at a disposable project, never a live one.
 *
 * Required environment:
 *   E2E_ALLOW_WRITES=1
 *   E2E_WORKER_EMAIL / E2E_WORKER_PASSWORD
 *   E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD
 * Optional:
 *   E2E_BASE_URL   defaults to the preview server started below
 *   CHROME_PATH    an already-installed Chromium (CI images ship one)
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const CHROME_PATH = process.env.CHROME_PATH;

export default defineConfig({
  testDir: './e2e',
  // The flows share one database. Running them at the same time would have the
  // admin's `reset_round` land in the middle of the worker's round.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile',
      // The app is built for a phone held one-handed; test it at that size.
      use: {
        ...devices['Pixel 7'],
        ...(CHROME_PATH && existsSync(CHROME_PATH)
          ? { launchOptions: { executablePath: CHROME_PATH } }
          : {}),
      },
    },
  ],

  // Only start a server when pointing at the default local preview.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run build && npm run preview -- --port 4173',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});

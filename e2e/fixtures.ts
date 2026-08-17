import { expect, test as base, type Page } from '@playwright/test';
import { actions, fields, nav } from '../src/lib/copy';

/**
 * The guard.
 *
 * These specs write to a real Supabase project, and the admin flow resets the
 * round — every completion in the database, for every user, gone. Nothing here
 * runs unless someone has deliberately said so.
 */
export const WRITES_ALLOWED = process.env.E2E_ALLOW_WRITES === '1';

export const SKIP_REASON =
  'E2E specs write to the live database (the admin flow calls reset_round). ' +
  'Set E2E_ALLOW_WRITES=1 and point .env at a disposable project to run them.';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see playwright.config.ts`);
  return value;
}

export const credentials = {
  get worker() {
    return { email: required('E2E_WORKER_EMAIL'), password: required('E2E_WORKER_PASSWORD') };
  },
  get admin() {
    return { email: required('E2E_ADMIN_EMAIL'), password: required('E2E_ADMIN_PASSWORD') };
  },
};

export async function signIn(page: Page, who: 'worker' | 'admin'): Promise<void> {
  const { email, password } = credentials[who];

  await page.goto('/signin');
  await page.getByLabel(fields.email).fill(email);
  await page.getByLabel(fields.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: nav.signIn }).click();

  await expect(page).not.toHaveURL(/\/signin/);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: nav.signOut }).first().click();
  await page.getByRole('button', { name: actions.confirm }).click();
  await expect(page).toHaveURL(/\/signin/);
}

export const test = base;
export { expect };

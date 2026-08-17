import { actions, dialogs, fields, labels, nav, toasts } from '../src/lib/copy';
import { expect, signIn, SKIP_REASON, test, WRITES_ALLOWED } from './fixtures';

/**
 * §12 flow 2 — admin: sign in → create a station → verify it appears in the
 * correct area → reset the round → verify all stations are not-done and the
 * counters are zero → confirm the admin is still signed in as themselves.
 *
 * ⚠️  DESTRUCTIVE AND IRREVERSIBLE. `reset_round` clears every completion in
 * the database and zeroes every user's counter — not just this test's. Run it
 * against a disposable project only. See the guard in fixtures.ts.
 *
 * The last assertion is the point of the flow, not an afterthought: in the
 * original app creating a user from the browser replaced the admin's own
 * session, so the admin silently became the account they had just made.
 */
test.describe('admin round management', () => {
  test.skip(!WRITES_ALLOWED, SKIP_REASON);

  test('creates a station, resets the round, and stays signed in', async ({ page }) => {
    await signIn(page, 'admin');

    const adminName = (await page.getByRole('banner').getByRole('heading').textContent())?.trim();
    expect(adminName).toBeTruthy();

    // The area to file the new station under: whichever the admin sees first.
    const areaCard = page.getByRole('link').filter({ hasText: labels.remainingShort }).first();
    const areaName = (await areaCard.textContent())?.split('\n')[0]?.trim() ?? '';

    // --- create a station -------------------------------------------------
    // A number far above any real one, so it cannot collide with the seeded
    // data and the uniqueness check inside the form.
    const stationNumber = 9000 + (Date.now() % 900);
    const stationName = `בדיקה ${String(stationNumber)}`;

    await page.goto('/stations/new');
    await page.getByLabel(fields.stationName).fill(stationName);
    await page.getByLabel(fields.stationNumber).fill(String(stationNumber));

    await page.getByLabel(fields.area).click();
    await page.getByRole('option', { name: areaName, exact: true }).click();

    await page.getByRole('button', { name: actions.save }).click();
    await expect(page.getByText(toasts.stationAdded)).toBeVisible();

    // --- it lands in the right area --------------------------------------
    await areaCard.click();
    await expect(page.getByRole('listitem').filter({ hasText: stationName })).toBeVisible();

    // Mark it, so the reset below has something to clear.
    const card = page.getByRole('listitem').filter({ hasText: stationName });
    await card.getByRole('button', { name: actions.markDone }).click();
    await page.getByRole('button', { name: actions.confirm }).click();
    await expect(page.getByText(toasts.stationCompleted)).toBeVisible();

    // --- reset the round --------------------------------------------------
    await page.goto('/dashboard');
    await page.getByRole('button', { name: actions.resetAll }).click();
    // Typed confirmation, not a bare "are you sure".
    await page.getByLabel(dialogs.resetRound.typeToConfirm).fill(dialogs.resetRound.confirmWord);
    await page.getByRole('button', { name: actions.resetAll }).last().click();
    await expect(page.getByText(toasts.roundReset)).toBeVisible();

    // --- everything is outstanding again ----------------------------------
    await page.goto('/');
    const areaAfter = page.getByRole('link').filter({ hasText: labels.remainingShort }).first();
    await areaAfter.click();

    const doneTab = page.getByRole('tab').nth(1);
    await expect(doneTab).toHaveText(labels.tabDone(0));

    // --- and the admin is still the admin ---------------------------------
    // Defect: creating an account from the browser used to replace the caller's
    // own session. Nothing in this flow may change who is signed in.
    await page.goto('/');
    await expect(page.getByRole('banner')).toContainText(adminName ?? '');
    await expect(page.getByRole('link', { name: nav.users })).toBeVisible();
  });
});

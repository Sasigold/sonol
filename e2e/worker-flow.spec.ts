import { actions, dialogs, labels } from '../src/lib/copy';
import { expect, signIn, SKIP_REASON, test, WRITES_ALLOWED } from './fixtures';

/**
 * §12 flow 1 — worker: sign in → open an area → mark a station done → verify it
 * moved to the done tab and the counter incremented → undo → verify it moved
 * back.
 *
 * This spec completes and then uncompletes a station, so it leaves the database
 * as it found it — but it does write. See the guard in fixtures.ts.
 */
test.describe('worker round', () => {
  test.skip(!WRITES_ALLOWED, SKIP_REASON);

  test('marks a station done and undoes it', async ({ page }) => {
    await signIn(page, 'worker');

    // Home lists the worker's areas. Take the first with something outstanding.
    const areaLink = page.getByRole('link').filter({ hasText: labels.remainingShort }).first();
    await expect(areaLink).toBeVisible();
    await areaLink.click();

    await expect(page).toHaveURL(/\/areas\//);

    const notDoneTab = page.getByRole('tab').first();
    const doneTab = page.getByRole('tab').nth(1);

    function countIn(text: string | null): number {
      // The tab labels carry their count in parentheses: "לא בוצע (12)".
      return Number(/\((\d+)\)/.exec(text ?? '')?.[1] ?? '0');
    }

    const notDoneBefore = countIn(await notDoneTab.textContent());
    const doneBefore = countIn(await doneTab.textContent());
    expect(notDoneBefore).toBeGreaterThan(0);

    // The first outstanding card, and the station's name so it can be found
    // again on the other tab.
    const card = page.getByRole('listitem').first();
    const stationName = (await card.getByRole('heading').textContent())?.trim() ?? '';
    expect(stationName).not.toBe('');

    await card.getByRole('button', { name: actions.markDone }).click();
    await page.getByRole('button', { name: actions.confirm }).click();

    // The counters move…
    await expect(notDoneTab).toHaveText(labels.tabNotDone(notDoneBefore - 1));
    await expect(doneTab).toHaveText(labels.tabDone(doneBefore + 1));

    // …and the station is on the done tab, not the outstanding one.
    await doneTab.click();
    const doneCard = page.getByRole('listitem').filter({ hasText: stationName });
    await expect(doneCard).toBeVisible();

    // Undo, from the done tab.
    await doneCard.getByRole('button', { name: actions.undoDone }).click();
    await expect(page.getByText(dialogs.confirmUncomplete.title)).toBeVisible();
    await page.getByRole('button', { name: actions.confirm }).click();

    // Back exactly where it started.
    await expect(notDoneTab).toHaveText(labels.tabNotDone(notDoneBefore));
    await expect(doneTab).toHaveText(labels.tabDone(doneBefore));

    await notDoneTab.click();
    await expect(page.getByRole('listitem').filter({ hasText: stationName })).toBeVisible();
  });
});

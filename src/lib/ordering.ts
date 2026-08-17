/**
 * Where a station sits in the drive order.
 *
 * `stations.sort_number` is `numeric(10,2)` for one stated reason: so a
 * station can be slotted between 12 and 13 as 12.5 without renumbering the
 * whole area. Nothing in the UI ever computed that number — the admin typed
 * it — so the two-decimal column was doing no work.
 *
 * Kept as pure functions rather than a hook: the arithmetic is the part worth
 * testing, and it does not need React to run.
 */

/** The column is numeric(10,2); Postgres would round anything longer anyway. */
const DECIMALS = 2;

function round(value: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * A number that sorts between `before` and `after`.
 *
 * `null` means "nothing on that side": no `before` places the station first in
 * the area, no `after` places it last, and neither means the area is empty.
 *
 * The midpoint can collide with an endpoint once the gap is narrower than the
 * column's precision — 12.00 and 12.01 have nothing between them at two
 * decimals. That case returns the midpoint anyway and lets the (area, number)
 * uniqueness check on the form report it, rather than silently picking a
 * different position than the one the admin chose.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;

  // First in the area: halve the smallest number rather than going to zero —
  // `sort_number` must stay positive, and halving leaves room to insert again.
  if (before === null) return round((after ?? 0) / 2);

  // Last in the area: a whole step past the end, so the numbers stay readable.
  if (after === null) return round(before + 1);

  return round((before + after) / 2);
}

/**
 * The `sort_number` for a station placed directly after `afterId`.
 *
 * `afterId === null` means "first in the area". `stations` may arrive in any
 * order; this sorts a copy, so the caller's list is untouched.
 */
export function positionAfter(
  stations: readonly { id: string; sort_number: number }[],
  afterId: string | null,
): number {
  const ordered = [...stations].sort((a, b) => a.sort_number - b.sort_number);

  if (afterId === null) {
    const first = ordered[0];
    return positionBetween(null, first ? first.sort_number : null);
  }

  const index = ordered.findIndex((station) => station.id === afterId);
  // An unknown id means the list moved under the selection — append rather
  // than guess at a position that no longer exists.
  if (index === -1) {
    const last = ordered[ordered.length - 1];
    return positionBetween(last ? last.sort_number : null, null);
  }

  const before = ordered[index];
  const after = ordered[index + 1];
  return positionBetween(before ? before.sort_number : null, after ? after.sort_number : null);
}

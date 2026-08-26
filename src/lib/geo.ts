import type { Coordinates } from './waze';

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in metres between two points (haversine).
 *
 * This is a deliberate second implementation of the formula that
 * `completion_locations` computes in SQL. The view is the source of truth for
 * the dashboard aggregate (CLAUDE.md §3 — read aggregates from views, don't sum
 * on the client). This copy exists only for the station card, where the two
 * points — the station's coordinates and the captured position — are already in
 * the row `useAreaStations` fetched, so computing the one distance locally is
 * cheaper than a round trip. If the formula changes, change both.
 */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Whether a captured position sits more than `thresholdMeters` from its station,
 * after forgiving the GPS fix's own accuracy radius so a poor lock does not cry
 * wolf. `distance` is null when either point is unknown — and then the answer is
 * `false`: a completion we cannot place is never flagged as far.
 *
 * Shared by the worker's at-completion warning in `AreaPage` (a tight threshold,
 * caught before the tap is recorded) and the admin's post-hoc flag on the
 * station card (a looser one, for review). Same rule, two thresholds — so the
 * accuracy handling can never drift between them.
 */
export function isFarFromStation(
  distance: number | null,
  accuracyMeters: number,
  thresholdMeters: number,
): boolean {
  if (distance === null) return false;
  return distance - accuracyMeters > thresholdMeters;
}

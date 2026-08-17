export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Client-side mirror of the SQL trigger `public.parse_waze_coordinates()`.
 *
 * The database is the authority — it parses once at write time so navigation
 * never re-parses. This copy exists only so the station form can show the
 * admin what WILL be stored before they save (§8.6). The two regexes are
 * deliberately identical to the trigger's; if one changes, change both, or the
 * form will confirm coordinates the database did not actually derive.
 */
const LAT_LON = /lat=(-?\d+\.?\d*)&lon=(-?\d+\.?\d*)/;
const LL = /ll=(-?\d+\.?\d*)[,%]+2?C?(-?\d+\.?\d*)/;

export function parseWazeLink(link: string | null | undefined): Coordinates | null {
  if (!link) return null;

  const match = LAT_LON.exec(link) ?? LL.exec(link);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // Mirrors the CHECK constraints on stations.latitude / .longitude. A link
  // that parses to an impossible point is not a usable link.
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Open Waze at the station.
 *
 * Tries the native app first, then falls back to the web. The fallback is
 * guarded by `document.hidden`: if the app opened, the page is backgrounded and
 * we must NOT also open a browser tab that the worker will find waiting for
 * them later.
 *
 * Returns false when the station has no coordinates, so the caller can disable
 * the button rather than fail silently (§8.5).
 */
export function navigateToStation(
  latitude: number | null,
  longitude: number | null,
  now: () => number = Date.now,
): boolean {
  if (latitude === null || longitude === null) return false;

  const deep = `waze://?ll=${String(latitude)}%2C${String(longitude)}&navigate=yes`;
  const web = `https://waze.com/ul?ll=${String(latitude)},${String(longitude)}&navigate=yes`;

  const start = now();
  window.location.href = deep;

  setTimeout(() => {
    if (now() - start < 2000 && !document.hidden) {
      window.open(web, '_blank', 'noopener,noreferrer');
    }
  }, 1500);

  return true;
}

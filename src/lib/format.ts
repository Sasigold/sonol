import { labels } from './copy';

/**
 * Time-based greeting (§8.4), computed in Asia/Jerusalem regardless of the
 * device clock's timezone — a phone roaming on a foreign carrier would
 * otherwise greet a field worker with "good evening" at noon.
 *
 * `< 12:00` → morning, `< 17:00` → noon, else evening.
 */
export function greeting(now: Date = new Date()): string {
  const hour = jerusalemHour(now);
  if (hour < 12) return labels.greetingMorning;
  if (hour < 17) return labels.greetingNoon;
  return labels.greetingEvening;
}

/** Hour 0-23 in Asia/Jerusalem, DST included, via the Intl database. */
export function jerusalemHour(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hour12: false,
  }).format(date);

  const hour = Number.parseInt(formatted, 10);
  // Intl renders midnight as "24" in some ICU versions.
  return Number.isNaN(hour) ? 0 : hour % 24;
}

/**
 * A duration of `seconds` in Hebrew, for the pace stats (§ pace).
 *
 * Rounds to the nearest whole minute — sub-minute precision is noise for a
 * travel leg — with a floor of one minute so a real leg never reads "0 דק׳".
 * Under an hour: "23 דק׳". An hour or more: "1:47 שע׳" with zero-padded
 * minutes. The `h:mm` run is built here, not in copy.ts, so copy stays a
 * declarative table; its digits are a Latin run, so callers mixing it into a
 * Hebrew sentence wrap it in `.ltr-isolate` / `<bdi>`.
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return labels.durationMinutes(totalMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return labels.durationHours(`${hours}:${String(minutes).padStart(2, '0')}`);
}

/**
 * A distance of `meters` in Hebrew, for the location checks (§ location).
 *
 * Under a kilometre: whole metres, "320 מ׳". A kilometre or more: one decimal
 * kilometre, "1.2 ק״מ". The number is a Latin run, so callers mixing it into a
 * Hebrew sentence wrap it in `.ltr-isolate`. Uses the geresh (׳) and gershayim
 * (״), not ASCII quotes.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return labels.distanceMeters(Math.round(meters));
  return labels.distanceKm((meters / 1000).toFixed(1));
}

/**
 * Whole minutes elapsed between two epoch-millisecond instants, floored.
 *
 * Trivial arithmetic, extracted so the rapid-completion warning's threshold
 * (§ dialogs.rapidComplete) is exercised by a unit test rather than only by a
 * component test.
 */
export function minutesSince(thenMs: number, nowMs: number): number {
  return Math.floor((nowMs - thenMs) / 60_000);
}

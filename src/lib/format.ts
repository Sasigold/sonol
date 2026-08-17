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

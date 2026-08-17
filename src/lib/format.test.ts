import { describe, expect, it } from 'vitest';
import { greeting, jerusalemHour } from './format';
import { labels } from './copy';

/**
 * The brief calls out the exact boundaries: 11:59, 12:00, 16:59, 17:00 —
 * computed in Asia/Jerusalem, not in the device's timezone.
 */
describe('greeting', () => {
  /** Build an instant that is `hour` local time in Jerusalem on a summer day (UTC+3). */
  const jerusalemSummer = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 6, 15, hour - 3, minute));

  it('switches at the boundaries', () => {
    expect(greeting(jerusalemSummer(11, 59))).toBe(labels.greetingMorning);
    expect(greeting(jerusalemSummer(12, 0))).toBe(labels.greetingNoon);
    expect(greeting(jerusalemSummer(16, 59))).toBe(labels.greetingNoon);
    expect(greeting(jerusalemSummer(17, 0))).toBe(labels.greetingEvening);
  });

  it('covers the ends of the day', () => {
    expect(greeting(jerusalemSummer(0, 0))).toBe(labels.greetingMorning);
    expect(greeting(jerusalemSummer(23, 59))).toBe(labels.greetingEvening);
  });

  it('uses Jerusalem time, not the device clock', () => {
    // 22:00 UTC is 01:00 the next day in Jerusalem — morning there, evening in UTC.
    const instant = new Date(Date.UTC(2026, 6, 15, 22, 0));
    expect(jerusalemHour(instant)).toBe(1);
    expect(greeting(instant)).toBe(labels.greetingMorning);
  });

  it('handles winter time (UTC+2) as well as summer', () => {
    // 10:30 UTC in January is 12:30 in Jerusalem — past the noon boundary.
    const winter = new Date(Date.UTC(2026, 0, 15, 10, 30));
    expect(jerusalemHour(winter)).toBe(12);
    expect(greeting(winter)).toBe(labels.greetingNoon);
  });
});

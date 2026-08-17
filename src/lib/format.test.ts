import { describe, expect, it } from 'vitest';
import { formatDistance, formatDuration, greeting, jerusalemHour, minutesSince } from './format';
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

describe('formatDuration', () => {
  it('rounds to whole minutes with a one-minute floor', () => {
    // A real travel leg is never shorter than the 60s the view already filters,
    // but the floor guards against a "0 דק׳" ever rendering.
    expect(formatDuration(59)).toBe('1 דק׳');
    expect(formatDuration(23 * 60)).toBe('23 דק׳');
  });

  it('rolls into an hours:minutes form at sixty minutes', () => {
    // 3599s rounds to 60 minutes, which is exactly the hour form, not "60 דק׳".
    expect(formatDuration(3599)).toBe('1:00 שע׳');
    expect(formatDuration(3600)).toBe('1:00 שע׳');
    expect(formatDuration(6420)).toBe('1:47 שע׳');
  });

  it('zero-pads the minutes past the hour', () => {
    expect(formatDuration(3660)).toBe('1:01 שע׳');
  });
});

describe('minutesSince', () => {
  it('floors the elapsed whole minutes', () => {
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(minutesSince(base, base + 30_000)).toBe(0);
    expect(minutesSince(base, base + 60_000)).toBe(1);
    expect(minutesSince(base, base + 119_000)).toBe(1);
  });
});

describe('formatDistance', () => {
  it('shows whole metres under a kilometre', () => {
    expect(formatDistance(0)).toBe('0 מ׳');
    expect(formatDistance(320)).toBe('320 מ׳');
    expect(formatDistance(320.6)).toBe('321 מ׳');
    expect(formatDistance(999)).toBe('999 מ׳');
  });

  it('rolls into one-decimal kilometres at a kilometre', () => {
    expect(formatDistance(1000)).toBe('1.0 ק״מ');
    expect(formatDistance(1200)).toBe('1.2 ק״מ');
    expect(formatDistance(15400)).toBe('15.4 ק״מ');
  });
});

import { describe, expect, it } from 'vitest';
import { formatCoordinates, parseWazeLink } from './waze';

describe('parseWazeLink', () => {
  it('reads the embed iframe shape the original app stored', () => {
    expect(
      parseWazeLink('https://embed.waze.com/iframe?zoom=15&lat=32.360590&lon=34.868798'),
    ).toEqual({ latitude: 32.36059, longitude: 34.868798 });
  });

  it('reads the ll= shape, comma or percent-encoded', () => {
    expect(parseWazeLink('https://waze.com/ul?ll=32.36,34.86&navigate=yes')).toEqual({
      latitude: 32.36,
      longitude: 34.86,
    });
    expect(parseWazeLink('https://waze.com/ul?ll=32.36%2C34.86')).toEqual({
      latitude: 32.36,
      longitude: 34.86,
    });
  });

  it('handles negative coordinates', () => {
    expect(parseWazeLink('?lat=-33.865143&lon=-151.209900')).toEqual({
      latitude: -33.865143,
      longitude: -151.2099,
    });
  });

  it('handles whole numbers without a decimal part', () => {
    expect(parseWazeLink('?lat=32&lon=34')).toEqual({ latitude: 32, longitude: 34 });
  });

  it('returns null for the empty and missing cases', () => {
    expect(parseWazeLink('')).toBeNull();
    expect(parseWazeLink(null)).toBeNull();
    expect(parseWazeLink(undefined)).toBeNull();
  });

  it('returns null for malformed input rather than guessing', () => {
    expect(parseWazeLink('https://waze.com/')).toBeNull();
    expect(parseWazeLink('lat=abc&lon=def')).toBeNull();
    expect(parseWazeLink('just some text')).toBeNull();
    expect(parseWazeLink('lat=32.5')).toBeNull(); // longitude missing
  });

  it('rejects coordinates the database CHECK constraints would refuse', () => {
    // Parsing a link the DB would reject means the form would promise a save
    // that then fails.
    expect(parseWazeLink('?lat=91.0&lon=34.0')).toBeNull();
    expect(parseWazeLink('?lat=-91.0&lon=34.0')).toBeNull();
    expect(parseWazeLink('?lat=32.0&lon=181.0')).toBeNull();
    expect(parseWazeLink('?lat=32.0&lon=-181.0')).toBeNull();
  });

  it('accepts the exact boundary values', () => {
    expect(parseWazeLink('?lat=90&lon=180')).toEqual({ latitude: 90, longitude: 180 });
    expect(parseWazeLink('?lat=-90&lon=-180')).toEqual({ latitude: -90, longitude: -180 });
  });

  it('prefers the lat/lon form when a link somehow carries both', () => {
    expect(parseWazeLink('?lat=1.5&lon=2.5&ll=9.9,8.8')).toEqual({
      latitude: 1.5,
      longitude: 2.5,
    });
  });
});

describe('formatCoordinates', () => {
  it('renders a fixed six-decimal pair for the confirmation line', () => {
    expect(formatCoordinates({ latitude: 32.36059, longitude: 34.868798 })).toBe(
      '32.360590, 34.868798',
    );
  });
});

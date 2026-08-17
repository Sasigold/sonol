import { describe, expect, it } from 'vitest';
import { positionAfter, positionBetween } from './ordering';

describe('positionBetween', () => {
  it('starts at 1 in an empty area', () => {
    expect(positionBetween(null, null)).toBe(1);
  });

  it('halves the first number rather than going to zero', () => {
    // sort_number must stay positive, and halving leaves room to insert again.
    expect(positionBetween(null, 1)).toBe(0.5);
    expect(positionBetween(null, 4)).toBe(2);
  });

  it('appends a whole step past the end', () => {
    expect(positionBetween(12, null)).toBe(13);
    expect(positionBetween(12.5, null)).toBe(13.5);
  });

  it('takes the midpoint — the 12.5 the schema was designed for', () => {
    expect(positionBetween(12, 13)).toBe(12.5);
    expect(positionBetween(12, 12.5)).toBe(12.25);
  });

  it('rounds to the two decimals the column stores', () => {
    // numeric(10,2) — Postgres would round it anyway, so the form must show
    // the value that will actually be saved.
    expect(positionBetween(1, 2.005)).toBe(1.5);
    expect(positionBetween(12.25, 12.5)).toBe(12.38);
  });
});

describe('positionAfter', () => {
  const stations = [
    { id: 'a', sort_number: 1 },
    { id: 'b', sort_number: 2 },
    { id: 'c', sort_number: 5 },
  ];

  it('places a station first when nothing precedes it', () => {
    expect(positionAfter(stations, null)).toBe(0.5);
  });

  it('places a station between two neighbours', () => {
    expect(positionAfter(stations, 'a')).toBe(1.5);
    expect(positionAfter(stations, 'b')).toBe(3.5);
  });

  it('appends after the last station', () => {
    expect(positionAfter(stations, 'c')).toBe(6);
  });

  it('sorts before reading, so an unordered list still works', () => {
    const shuffled = [stations[2], stations[0], stations[1]].filter(
      (station): station is { id: string; sort_number: number } => station !== undefined,
    );
    expect(positionAfter(shuffled, 'a')).toBe(1.5);
  });

  it('does not reorder the caller list', () => {
    const before = stations.map((station) => station.id);
    positionAfter(stations, 'b');
    expect(stations.map((station) => station.id)).toEqual(before);
  });

  it('appends when the id is gone, rather than guessing', () => {
    expect(positionAfter(stations, 'deleted')).toBe(6);
  });

  it('starts at 1 in an empty area', () => {
    expect(positionAfter([], null)).toBe(1);
    expect(positionAfter([], 'anything')).toBe(1);
  });
});

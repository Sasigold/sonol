import { describe, expect, it } from 'vitest';
import { distanceMeters, isFarFromStation } from './geo';

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    const p = { latitude: 32.0853, longitude: 34.7818 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('matches a known short distance within a small tolerance', () => {
    // Tel Aviv → Jaffa clock tower, ~3.4 km great-circle.
    const telAviv = { latitude: 32.0853, longitude: 34.7818 };
    const jaffa = { latitude: 32.0546, longitude: 34.7519 };
    const d = distanceMeters(telAviv, jaffa);
    expect(d).toBeGreaterThan(4000);
    expect(d).toBeLessThan(4600);
  });

  it('is symmetric', () => {
    const a = { latitude: 31.7683, longitude: 35.2137 };
    const b = { latitude: 32.794, longitude: 34.9896 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it('flags a ~600m offset as beyond the 500m threshold', () => {
    // ~0.0054° of latitude ≈ 600m.
    const station = { latitude: 32.0, longitude: 34.8 };
    const away = { latitude: 32.0054, longitude: 34.8 };
    expect(distanceMeters(station, away)).toBeGreaterThan(500);
  });
});

describe('isFarFromStation', () => {
  it('is false when the distance is unknown, so an unplaced completion is never flagged', () => {
    expect(isFarFromStation(null, 0, 100)).toBe(false);
  });

  it('flags a distance clearly beyond the threshold', () => {
    expect(isFarFromStation(250, 10, 100)).toBe(true);
  });

  it('does not flag a distance within the threshold', () => {
    expect(isFarFromStation(80, 5, 100)).toBe(false);
  });

  it('forgives the fix accuracy before comparing, so a poor lock does not cry wolf', () => {
    // 140m away, but a ±60m fix could place the worker as close as 80m — under
    // the 100m threshold, so it is not flagged.
    expect(isFarFromStation(140, 60, 100)).toBe(false);
    // A tight ±5m fix on the same distance leaves it well beyond.
    expect(isFarFromStation(140, 5, 100)).toBe(true);
  });
});

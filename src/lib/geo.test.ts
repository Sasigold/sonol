import { describe, expect, it } from 'vitest';
import { distanceMeters } from './geo';

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

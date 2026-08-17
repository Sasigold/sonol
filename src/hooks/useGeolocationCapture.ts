import { useEffect, useRef } from 'react';

/**
 * A worker position captured at completion time — the station-target coordinates
 * live on `stations`; this is where the van actually was.
 */
export interface CapturedPosition {
  latitude: number;
  longitude: number;
  /** The browser's reported accuracy radius in metres; lets the "far" check forgive a poor fix. */
  accuracy: number;
}

interface Fix extends CapturedPosition {
  at: number;
}

/** A fix older than this is not attributed to the station being marked now. */
const STALE_MS = 2 * 60_000;

/** watchPosition tuning: high accuracy, reuse a recent OS fix, don't hang forever. */
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 30_000,
  timeout: 27_000,
};

/**
 * Keeps a warm GPS fix while the completion screen is open, and hands it over
 * synchronously when a station is confirmed.
 *
 * Why a watch feeding a ref rather than `getCurrentPosition` at confirm time:
 * capture must be synchronous. A completion cannot wait on a GPS callback — the
 * worker is one-handed in sunlight, and offline there is no fix to await at all.
 * The watch keeps the latest position in a ref; `capture()` reads it with no
 * await and returns null when it is missing or stale, so the completion always
 * proceeds and simply carries no position in that case.
 *
 * The captured value travels with the tap (into the mutation variables and, for
 * an offline tap, onto the queued record) so a dead-zone completion replayed
 * later still reports where the worker stood, not where they reconnected.
 *
 * Degrades silently: no `navigator.geolocation` (jsdom, insecure context) or a
 * denied permission simply leaves `capture()` returning null.
 */
export function useGeolocationCapture(): { capture: () => CapturedPosition | null } {
  const fix = useRef<Fix | null>(null);

  useEffect(() => {
    // The DOM lib types `navigator.geolocation` as always present, but an
    // insecure context or jsdom has none — widen to make the guard meaningful,
    // and capture the reference now rather than reading the global at cleanup.
    const geolocation: Geolocation | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    if (!geolocation) return;

    const id = geolocation.watchPosition(
      (position) => {
        fix.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: Date.now(),
        };
      },
      () => {
        // Denied, unavailable, or timed out: drop any stale fix so we never
        // attach an old position to a new completion.
        fix.current = null;
      },
      WATCH_OPTIONS,
    );

    return () => {
      geolocation.clearWatch(id);
    };
  }, []);

  return {
    capture: () => {
      const current = fix.current;
      if (current === null) return null;
      if (Date.now() - current.at > STALE_MS) return null;
      return {
        latitude: current.latitude,
        longitude: current.longitude,
        accuracy: current.accuracy,
      };
    },
  };
}

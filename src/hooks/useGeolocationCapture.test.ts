import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGeolocationCapture } from './useGeolocationCapture';

type SuccessCb = (position: {
  coords: { latitude: number; longitude: number; accuracy: number };
}) => void;
type ErrorCb = () => void;

describe('useGeolocationCapture', () => {
  let watchPosition: ReturnType<typeof vi.fn>;
  let clearWatch: ReturnType<typeof vi.fn>;
  let success: SuccessCb | null;
  let failure: ErrorCb | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    success = null;
    failure = null;
    watchPosition = vi.fn((ok: SuccessCb, err: ErrorCb) => {
      success = ok;
      failure = err;
      return 1;
    });
    clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns null before any fix has arrived', () => {
    const { result } = renderHook(() => useGeolocationCapture());
    expect(result.current.capture()).toBeNull();
  });

  it('returns the latest fresh fix', () => {
    const { result } = renderHook(() => useGeolocationCapture());
    success?.({ coords: { latitude: 32.1, longitude: 34.8, accuracy: 8 } });
    expect(result.current.capture()).toEqual({ latitude: 32.1, longitude: 34.8, accuracy: 8 });
  });

  it('discards a fix older than two minutes', () => {
    const { result } = renderHook(() => useGeolocationCapture());
    success?.({ coords: { latitude: 32.1, longitude: 34.8, accuracy: 8 } });
    vi.setSystemTime(2 * 60_000 + 1);
    expect(result.current.capture()).toBeNull();
  });

  it('returns null after a permission error clears the fix', () => {
    const { result } = renderHook(() => useGeolocationCapture());
    success?.({ coords: { latitude: 32.1, longitude: 34.8, accuracy: 8 } });
    failure?.();
    expect(result.current.capture()).toBeNull();
  });

  it('clears the watch on unmount', () => {
    const { unmount } = renderHook(() => useGeolocationCapture());
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(1);
  });

  it('degrades to null when geolocation is unavailable', () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useGeolocationCapture());
    expect(result.current.capture()).toBeNull();
  });
});

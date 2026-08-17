import { afterEach, describe, expect, it } from 'vitest';
import { disableZoomGestures } from './no-zoom';

/**
 * `gesturestart` / `gesturechange` / `gestureend` are WebKit-only and jsdom
 * has no idea what they are — which is fine, because nothing here depends on
 * the browser's own behaviour. What matters is that a listener is attached to
 * each of the three and cancels the event.
 */
const GESTURES = ['gesturestart', 'gesturechange', 'gestureend'];

let teardown: (() => void) | null = null;

afterEach(() => {
  teardown?.();
  teardown = null;
});

/** Cancelable, or `preventDefault()` is a silent no-op and the test proves nothing. */
function fire(name: string): boolean {
  return document.dispatchEvent(new Event(name, { cancelable: true, bubbles: true }));
}

describe('disableZoomGestures', () => {
  it('cancels every pinch-zoom gesture event', () => {
    teardown = disableZoomGestures();

    for (const name of GESTURES) {
      // dispatchEvent returns false once preventDefault has been called.
      expect(fire(name), name).toBe(false);
    }
  });

  it('does not cancel anything before it is called', () => {
    for (const name of GESTURES) {
      expect(fire(name), name).toBe(true);
    }
  });

  it('detaches on teardown, so nothing leaks between mounts', () => {
    disableZoomGestures()();

    for (const name of GESTURES) {
      expect(fire(name), name).toBe(true);
    }
  });
});

/**
 * Zoom gestures off, so the app reads as an application rather than a web page.
 *
 * Three mechanisms are needed because no single one covers every browser:
 *
 * 1. `user-scalable=no, maximum-scale=1` in the viewport meta (`index.html`).
 *    Android Chrome honours it, and so does iOS once the PWA is installed to
 *    the home screen — which is how a field worker actually opens this.
 * 2. `touch-action: pan-x pan-y` on `<html>` (`globals.css`). Panning stays
 *    allowed, pinch and double-tap zoom do not. Note this is NOT
 *    `touch-action: manipulation`, which only removes double-tap and leaves
 *    pinch working.
 * 3. This module, for iOS Safari in an ordinary tab: it has ignored
 *    `user-scalable=no` since iOS 10, and treats pinch as a browser-level
 *    gesture that `touch-action` does not reach. The non-standard, WebKit-only
 *    `gesture*` events are the only hook left.
 *
 * ACCESSIBILITY: this deliberately fails WCAG 2.1 SC 1.4.4 (Resize Text), which
 * asks that content scale to 200%. It is a product decision, made because the
 * app is a one-handed tool in a moving vehicle where an accidental pinch
 * strands the worker at 3x with no visible way back. The mitigation is that
 * nothing here needs zooming to be legible: body text is >= 16px, the type
 * scale has no step below 13px, every touch target is >= 48x48, and contrast is
 * AA throughout. If that ever stops being true, this is the first thing to
 * reconsider.
 */

/** WebKit-only, so not in `DocumentEventMap` — hence the string literals. */
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

/**
 * Returns its own teardown. Nothing calls it — the listeners live as long as
 * the document does — but returning it keeps the module testable without
 * leaking handlers between cases.
 */
export function disableZoomGestures(target: Document = document): () => void {
  const block = (event: Event): void => {
    event.preventDefault();
  };

  for (const name of GESTURE_EVENTS) {
    // `passive: false` is required: a passive listener may not preventDefault,
    // and Safari defaults touch-adjacent listeners to passive.
    target.addEventListener(name, block, { passive: false });
  }

  return () => {
    for (const name of GESTURE_EVENTS) {
      target.removeEventListener(name, block);
    }
  };
}

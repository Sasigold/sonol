/**
 * The boot splash: the app icon's artwork, full screen, from first paint until
 * the app knows who is signed in.
 *
 * It is plain markup in index.html, outside #root, so it paints before a byte
 * of JavaScript or of the CSS bundle has arrived — on a weak signal that is the
 * difference between a logo and a white screen. It also continues the native
 * launch screen without a jump: the iOS launch images and the Android splash
 * (manifest `background_color` + icon) draw the same thing in the same place.
 *
 * It is never held up on purpose. It stays exactly as long as the session is
 * being restored, which replaces the skeleton that used to flash there, and
 * not a moment longer.
 */

const SPLASH_ID = 'splash';

/** Longer than the 250 ms fade in index.html, so this only ever cleans up. */
const REMOVE_AFTER_MS = 400;

/** Fades the splash out and removes it. Safe to call any number of times. */
export function hideSplash(): void {
  const splash = document.getElementById(SPLASH_ID);
  if (!splash || splash.dataset.state === 'leaving') return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    splash.remove();
    return;
  }

  splash.dataset.state = 'leaving';
  splash.addEventListener(
    'transitionend',
    () => {
      splash.remove();
    },
    { once: true },
  );
  // `transitionend` never fires in a tab hidden mid-fade.
  window.setTimeout(() => {
    splash.remove();
  }, REMOVE_AFTER_MS);
}

/**
 * The backstop: whatever happens during boot — a route that throws, a session
 * restore that hangs — the splash never traps the user. Longer than any normal
 * start, short enough that nobody is left staring at a logo.
 */
export const SPLASH_MAX_MS = 6000;

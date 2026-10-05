import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hideSplash } from './splash';

function mountSplash(): HTMLElement {
  const splash = document.createElement('div');
  splash.id = 'splash';
  document.body.append(splash);
  return splash;
}

function setReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({ matches: reduce, media: query }) as MediaQueryList,
  });
}

describe('hideSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById('splash')?.remove();
  });

  it('fades the splash out, then removes it', () => {
    const splash = mountSplash();

    hideSplash();
    expect(splash.dataset.state).toBe('leaving');
    expect(document.getElementById('splash')).not.toBeNull();

    splash.dispatchEvent(new Event('transitionend'));
    expect(document.getElementById('splash')).toBeNull();
  });

  it('still removes it when the fade never reports finishing (hidden tab)', () => {
    mountSplash();
    hideSplash();
    vi.advanceTimersByTime(400);
    expect(document.getElementById('splash')).toBeNull();
  });

  it('removes it at once under reduced motion', () => {
    setReducedMotion(true);
    mountSplash();
    hideSplash();
    expect(document.getElementById('splash')).toBeNull();
  });

  it('is a no-op when called again, or with no splash on the page', () => {
    const splash = mountSplash();
    hideSplash();
    hideSplash();
    expect(splash.dataset.state).toBe('leaving');

    splash.remove();
    expect(() => {
      hideSplash();
    }).not.toThrow();
  });
});

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement `matchMedia`, but the DOM lib types it as always
 * present — so a runtime guard reads as dead code to the type-checker. Define
 * it unconditionally instead of guarding.
 *
 * The theme layer reads it for the `prefers-color-scheme` default.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * jsdom implements no layout and no pointer capture, and does not stub either.
 * Radix Select calls all four while opening — `scrollIntoView` to reveal the
 * active item, the pointer-capture trio to keep a press-and-drag selection on
 * the listbox — so a test that merely OPENS a Select throws before it can
 * assert anything.
 *
 * No-ops rather than mocks: nothing here asserts on scrolling or on capture,
 * and pretending to track capture state would be a fiction the tests could
 * come to rely on.
 */
for (const method of ['scrollIntoView', 'setPointerCapture', 'releasePointerCapture'] as const) {
  Object.defineProperty(Element.prototype, method, {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
}

Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  writable: true,
  configurable: true,
  value: vi.fn(() => false),
});

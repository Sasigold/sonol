import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** The "data" duration — a value moving to a new value (globals.css, Motion). */
const DURATION_MS = 600;

/**
 * A number that counts to its value instead of jumping there.
 *
 * Realtime updates change a dashboard figure while someone is looking at it;
 * counting makes the change itself visible, which a silent swap of digits is
 * not. On mount it counts up from zero.
 *
 * The visible digits are written straight into the DOM (sixty React renders a
 * second for a count would be waste), so React never owns that text node. The
 * real value sits beside it for assistive tech and for tests, which therefore
 * always read the settled figure.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = shown.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === value || reduced) {
      node.textContent = String(value);
      shown.current = value;
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(from + (value - from) * eased);
      node.textContent = String(current);
      shown.current = current;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    node.textContent = String(from);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <>
      <span ref={ref} aria-hidden className={cn('tabular-nums', className)} />
      <span className="sr-only">{value}</span>
    </>
  );
}

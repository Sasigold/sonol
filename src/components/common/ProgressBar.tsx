import { useId } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  done: number;
  total: number;
  className?: string;
  label?: string;
}

export function ProgressBar({ done, total, className, label }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
      className={cn(
        'bg-surface-alt border-border h-2 w-full overflow-hidden rounded-full border',
        className,
      )}
    >
      {/* Fills from the inline start (the right), charges in on mount, and
          glides to each new value. Its colour runs neon at the tip to green at
          the base — `--grad-progress` is written for RTL. */}
      <div
        className="fx-bar-fill bg-success h-full rounded-full bg-(image:--grad-progress) transition-[inline-size] duration-600 ease-(--ease-emphasized)"
        style={{ inlineSize: `${String(percent)}%` }}
      />
    </div>
  );
}

/** Compact ring for the area cards (§8.4). */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const gradientId = `arc-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--neon)" />
            <stop offset="1" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-border" />
        {/* pathLength 100 makes the offset the percentage itself. */}
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          className="fx-arc-fill transition-[stroke-dashoffset] duration-600 ease-(--ease-emphasized)"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
        />
      </svg>
      {/* The number is the accessible value; the ring is decoration. */}
      <span
        className={cn(
          'text-caption absolute tabular-nums',
          percent === 100 ? 'text-success font-bold' : 'text-text',
        )}
      >
        {percent}%
      </span>
    </span>
  );
}

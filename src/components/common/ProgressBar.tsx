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
      className={cn('bg-surface-alt h-2 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className="bg-success h-full rounded-full transition-[width] duration-250"
        style={{ inlineSize: `${String(percent)}%` }}
      />
    </div>
  );
}

/** Compact ring for the area cards (§8.4). */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-success transition-[stroke-dashoffset] duration-250"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      {/* The number is the accessible value; the ring is decoration. */}
      <span className="text-caption text-text absolute">{percent}%</span>
    </span>
  );
}

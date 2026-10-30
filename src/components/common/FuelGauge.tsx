import { useId, type CSSProperties } from 'react';
import { Fuel } from 'lucide-react';
import { AnimatedNumber } from '@/components/fx/AnimatedNumber';
import { cn } from '@/lib/utils';

interface FuelGaugeProps {
  done: number;
  total: number;
  /** The sentence under the figure, e.g. `labels.roundProgress(done, total)`. */
  caption: string;
  className?: string | undefined;
}

/* The dial, in a 240×132 box: centre (120, 120), radius 100. */
const CX = 120;
const CY = 120;
const RADIUS = 100;

/**
 * Point on the dial at `fraction` of the way round. The dial reads like the
 * rest of the app — from the inline START: 0 is the right-hand end, 1 the
 * left-hand end, over the top.
 */
function onDial(fraction: number, radius: number): { x: number; y: number } {
  const angle = Math.PI * fraction;
  return { x: CX + Math.cos(angle) * radius, y: CY - Math.sin(angle) * radius };
}

/** Right end to left end over the top: sweep-flag 0 is anticlockwise on screen. */
const ARC_PATH = `M${String(CX + RADIUS)} ${String(CY)} A${String(RADIUS)} ${String(RADIUS)} 0 0 0 ${String(CX - RADIUS)} ${String(CY)}`;

const TICKS = Array.from({ length: 11 }, (_, index) => {
  const fraction = index / 10;
  const major = index % 5 === 0;
  return { fraction, major, from: onDial(fraction, 78), to: onDial(fraction, major ? 64 : 70) };
});

/**
 * The round as a fuel gauge: how full the round is, not how empty the tank.
 *
 * A dial for the one number a worker or admin checks first. It carries no
 * information the figure and sentence under it do not also state — the dial is
 * the at-a-glance read, the text is the exact one, and `role="progressbar"`
 * gives assistive tech the values directly.
 *
 * The arc and needle charge in on mount and then glide to each new value
 * (600ms, the "data" duration), so a realtime update is seen to move.
 */
export function FuelGauge({ done, total, caption, className }: FuelGaugeProps) {
  const fraction = total > 0 ? Math.min(1, done / total) : 0;
  const percent = Math.round(fraction * 100);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <div
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={caption}
      className={cn('flex flex-col items-center gap-2', className)}
    >
      <svg viewBox="0 0 240 132" className="fx-gauge w-full max-w-xs" aria-hidden>
        <defs>
          <linearGradient id={`${id}-arc`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="var(--fuel)" />
            <stop offset="0.5" stopColor="var(--neon)" />
            <stop offset="1" stopColor="var(--success)" />
          </linearGradient>
        </defs>

        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--surface-alt)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--border)"
          strokeWidth="16"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d={ARC_PATH}
          fill="none"
          stroke={`url(#${id}-arc)`}
          strokeWidth="16"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
          className="fx-arc-fill fx-gauge-arc transition-[stroke-dashoffset] duration-600 ease-(--ease-emphasized)"
        />

        {TICKS.map((tick) => (
          <line
            key={tick.fraction}
            x1={tick.from.x}
            y1={tick.from.y}
            x2={tick.to.x}
            y2={tick.to.y}
            stroke="var(--text-muted)"
            strokeWidth={tick.major ? 3 : 1.5}
            strokeLinecap="round"
            opacity={tick.major ? 0.9 : 0.5}
          />
        ))}

        {/* The needle points at 0 (the right end) and is turned anticlockwise. */}
        <g
          className="fx-needle transition-transform duration-600 ease-(--ease-emphasized)"
          style={{ '--angle': `${String(-180 * fraction)}deg` } as CSSProperties}
        >
          <path
            d={`M${String(CX)} ${String(CY - 4)} L${String(CX + 84)} ${String(CY)} L${String(CX)} ${String(CY + 4)} Z`}
            fill="var(--danger)"
          />
        </g>
        <circle
          cx={CX}
          cy={CY}
          r="11"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <circle cx={CX} cy={CY} r="4" fill="var(--danger)" />
      </svg>

      <p className="flex items-center gap-2">
        <Fuel className="text-fuel size-6" aria-hidden />
        <span className="text-display fx-text-gradient font-extrabold tracking-tight">
          <bdi>
            <AnimatedNumber value={percent} />%
          </bdi>
        </span>
      </p>
      <p className="text-body-strong text-text text-center">{caption}</p>
    </div>
  );
}

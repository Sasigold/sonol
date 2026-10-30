import { useEffect, useEffectEvent, useId, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Trophy } from 'lucide-react';
import { celebrate, labels } from '@/lib/copy';
import { cn } from '@/lib/utils';

interface CompletionFxProps {
  stationName: string;
  areaName: string;
  /** Stations already done in the area BEFORE this completion. */
  doneBefore: number;
  /** Stations in the area. */
  total: number;
  /** Called once the effect has played out; the caller unmounts it. */
  onFinished: () => void;
}

/** How long the overlay stays, in ms. The choreography inside is in globals.css. */
const DURATION_MS = 1800;
const AREA_DURATION_MS = 3400;
/** Under reduced motion only the final frame is shown, so it need not linger. */
const REDUCED_DURATION_MS = 1400;

/**
 * Haptic patterns, ms on/off. Android only — iOS Safari has no Vibration API,
 * and the guard below makes that a no-op rather than an error. The worker's
 * eyes are on the road as often as on the screen; a buzz in the hand confirms
 * the tap without a look.
 */
const HAPTIC_STATION = [18, 50, 28];
const HAPTIC_AREA = [24, 60, 24, 60, 140];

/**
 * The tank's liquid surface, in the SVG's user units, for a fill fraction.
 * The clip circle spans y = -60…60; 0 sits just under the floor and 1 just
 * over the brim, so an empty tank shows nothing and a full one no trough.
 */
function surfaceY(fraction: number): number {
  return 64 - 130 * Math.min(1, Math.max(0, fraction));
}

/** One 60-unit wavelength repeated across 360 units, closed into a body. */
const WAVE_PATH = `M-180 0${' q15 -7 30 0 t30 0'.repeat(6)} V150 H-180 Z`;

/** Twelve sparks round the dial. */
const SPARK_ANGLES = Array.from({ length: 12 }, (_, index) => index * 30);

const CONFETTI_COLOURS = [
  'var(--fuel)',
  'var(--neon)',
  'var(--success)',
  'var(--brand-400)',
  'var(--fuel-soft)',
];

/**
 * The area-complete burst. Spread on the golden angle so no two neighbours fly
 * the same way — computed once at module load, so render stays pure.
 */
const CONFETTI = Array.from({ length: 32 }, (_, index) => {
  const angle = (index * 137.508 * Math.PI) / 180;
  const speed = 120 + ((index * 53) % 110);
  const up = Math.sin(angle) * speed * 0.8 - 80;
  return {
    dx: Math.cos(angle) * speed,
    up,
    fall: up + 280 + (index % 5) * 24,
    rot: (index % 2 === 0 ? 1 : -1) * (180 + ((index * 37) % 360)),
    delay: 900 + (index % 6) * 35,
    colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length] ?? 'var(--fuel)',
    round: index % 3 === 0,
  };
});

/** Custom properties in an inline style, which `CSSProperties` does not type. */
function vars(values: Record<string, string>): CSSProperties {
  return values;
}

/**
 * "Fuel-up" — the feedback for marking a station done.
 *
 * A fuel drop falls into a round tank; the tank fills to the area's NEW level
 * and the gauge ring around it sweeps to match; a check is stamped on top and
 * a ring of sparks goes out. The fill is the meaning: it is this area's
 * progress, so the worker sees how much of the round is left without reading
 * a number. On the area's last station the tank fills to the brim, a trophy
 * rises and the screen bursts.
 *
 * It never blocks: the overlay is `pointer-events: none` and unmounts itself,
 * so a worker who taps on through it loses nothing. It is `aria-hidden`; the
 * caller announces the same facts through a live region that outlives it.
 *
 * Portalled to <body> so no transformed ancestor (the page's own entrance
 * animation) can become the containing block of its `position: fixed`.
 */
export function CompletionFx({
  stationName,
  areaName,
  doneBefore,
  total,
  onFinished,
}: CompletionFxProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const safeTotal = Math.max(total, 1);
  const doneAfter = Math.min(doneBefore + 1, safeTotal);
  const areaComplete = doneAfter >= safeTotal;
  const from = doneBefore / safeTotal;
  const to = doneAfter / safeTotal;
  const duration = areaComplete ? AREA_DURATION_MS : DURATION_MS;

  const finish = useEffectEvent(onFinished);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if ('vibrate' in navigator) navigator.vibrate(areaComplete ? HAPTIC_AREA : HAPTIC_STATION);
    } catch {
      // Some embedded browsers expose the method and then refuse it.
    }
    const timer = window.setTimeout(
      () => {
        finish();
      },
      reduced ? REDUCED_DURATION_MS : duration,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [areaComplete, duration]);

  return createPortal(
    <div
      aria-hidden
      className="fx-complete pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 motion-reduce:animate-none"
      style={vars({ '--fx-total': `${String(duration)}ms` })}
    >
      {/* A scrim, so the effect does not compete with the card text under it. */}
      <div className="bg-bg/75 absolute inset-0" />
      <div className="fx-complete-tint absolute inset-0" data-area={areaComplete || undefined} />

      {areaComplete ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              className={cn(
                'fx-confetti',
                piece.round ? 'size-2 rounded-full' : 'h-3 w-2 rounded-sm',
              )}
              style={vars({
                '--dx': `${piece.dx.toFixed(1)}px`,
                '--up': `${piece.up.toFixed(1)}px`,
                '--fall': `${piece.fall.toFixed(1)}px`,
                '--rot': `${String(piece.rot)}deg`,
                '--delay': `${String(piece.delay)}ms`,
                background: piece.colour,
              })}
            />
          ))}
        </div>
      ) : null}

      <svg viewBox="-100 -100 200 200" className="fx-complete-stage relative">
        <defs>
          <radialGradient id={`${id}-bloom`}>
            <stop offset="0" stopColor="var(--neon)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--neon)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-fuel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--fuel-soft)" />
            <stop offset="1" stopColor="var(--fuel)" />
          </linearGradient>
          <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--neon)" />
            <stop offset="1" stopColor="var(--success)" />
          </linearGradient>
          <clipPath id={`${id}-tank`}>
            <circle r="60" />
          </clipPath>
        </defs>

        <circle className="fx-bloom" r="98" fill={`url(#${id}-bloom)`} />

        {/* Shockwaves from the drop's landing. */}
        <circle className="fx-shock" r="66" fill="none" stroke="var(--neon)" strokeWidth="2" />
        <circle className="fx-shock" r="66" fill="none" stroke="var(--neon)" strokeWidth="1.5" />

        {/* The gauge: the area's progress, sweeping from the old value to the new. */}
        <circle r="82" fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          className="fx-arc"
          r="82"
          fill="none"
          stroke={`url(#${id}-arc)`}
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          transform="rotate(-90)"
          style={vars({ '--from': String(100 - from * 100), '--to': String(100 - to * 100) })}
        />

        {/* The tank and its fuel. */}
        <circle r="64" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        <g clipPath={`url(#${id}-tank)`}>
          <g
            className="fx-liquid"
            style={vars({
              '--from': `${surfaceY(from).toFixed(1)}px`,
              '--to': `${surfaceY(to).toFixed(1)}px`,
            })}
          >
            <path
              className="fx-wave fx-wave-back"
              d={WAVE_PATH}
              fill="var(--fuel-soft)"
              opacity="0.45"
              transform="translate(-30 -4)"
            />
            <path className="fx-wave" d={WAVE_PATH} fill={`url(#${id}-fuel)`} />
            <circle className="fx-bubble" cx="-18" cy="40" r="3" fill="#fff" opacity="0.8" />
            <circle className="fx-bubble" cx="14" cy="46" r="2.5" fill="#fff" opacity="0.8" />
            <circle className="fx-bubble" cx="2" cy="52" r="2" fill="#fff" opacity="0.8" />
          </g>
        </g>
        <circle r="60" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1" />

        {/* The drop, landing on the level the tank held before. */}
        <path
          className="fx-drop"
          d="M0 -16C7 -7 11 -1 11 5A11 11 0 0 1 -11 5C-11 -1 -7 -7 0 -16Z"
          fill={`url(#${id}-fuel)`}
          style={vars({ '--land': `${surfaceY(from).toFixed(1)}px` })}
        />

        {SPARK_ANGLES.map((angle) => (
          <g key={angle} transform={`rotate(${String(angle)})`}>
            <line
              className="fx-spark"
              x1="88"
              x2="100"
              y1="0"
              y2="0"
              stroke={angle % 60 === 0 ? 'var(--fuel)' : 'var(--neon)'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* The stamp. A dark under-stroke keeps the white legible on amber. */}
        <g className="fx-check-pop">
          <path
            className="fx-check"
            d="M-26 2L-8 20L28 -18"
            fill="none"
            stroke="rgb(4 16 31 / 0.35)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
          <path
            className="fx-check"
            d="M-26 2L-8 20L28 -18"
            fill="none"
            stroke="#fff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
        </g>
      </svg>

      <div className="fx-caption fx-glass border-border shadow-overlay relative flex max-w-sm flex-col items-center gap-1 rounded-lg border px-6 py-4 text-center">
        {areaComplete ? (
          <>
            <Trophy className="fx-trophy text-fuel size-10" />
            <p className="text-display fx-text-gradient">{celebrate.areaDone}</p>
            <p className="text-body text-text">{celebrate.areaDoneBody(areaName)}</p>
          </>
        ) : (
          <>
            <p className="text-display fx-text-gradient">{celebrate.stationDone}</p>
            <p className="text-body-strong text-text">{stationName}</p>
            <p className="text-small text-text-muted">{labels.roundProgress(doneAfter, total)}</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

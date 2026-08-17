import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { EmptyState } from '@/components/common/EmptyState';
import { daily } from '@/lib/copy';
import type { RoundDailyStat } from '@/hooks/useDashboard';

/**
 * Completions per day for the current round.
 *
 * Vertical bars — a day is an ordinal along one axis and a phone has room for a
 * short `d/M` tick under each. ONE hue, the same choice WorkerChart documents:
 * a single measure across days, so per-bar colour would carry nothing the
 * height does not, and green stays reserved for "done" everywhere else.
 *
 * Buckets arrive already in Asia/Jerusalem from `round_daily_stats`, so `day`
 * is a plain date string and no timezone maths runs here.
 */

/**
 * The day tick, drawn by hand so the `d/M` run stays left-to-right.
 *
 * A bare SVG text of "17/8" sitting in this RTL app reorders to "8/17" under
 * the bidi algorithm. Pinning `direction: ltr` on the text box keeps the digits
 * in reading order; `text-anchor: middle` centres it under its bar.
 */
function DayTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const value = payload?.value ?? '';
  const label = value ? format(parseISO(value), 'd/M', { locale: he }) : '';
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor="middle"
      style={{ direction: 'ltr' }}
      fill="var(--text-muted)"
      fontSize={13}
    >
      {label}
    </text>
  );
}

export function DailyChart({ stats }: { stats: RoundDailyStat[] }) {
  const data = stats
    .filter((stat) => stat.day !== null)
    .map((stat) => ({
      day: stat.day ?? '',
      value: stat.completed_count ?? 0,
    }));

  if (data.length === 0) {
    return <EmptyState title={daily.empty.title} description={daily.empty.body} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={{ blockSize: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            {/* `reversed` puts the oldest day on the right, so the days read
                right-to-left like the rest of the app. */}
            <XAxis
              dataKey="day"
              reversed
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={<DayTick />}
            />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip
              cursor={{ fill: 'var(--surface-alt)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text)',
                direction: 'rtl',
              }}
              labelFormatter={(value) =>
                typeof value === 'string' && value
                  ? format(parseISO(value), 'd/M/yyyy', { locale: he })
                  : ''
              }
              formatter={(value) => [String(value ?? 0), daily.seriesLabel]}
            />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table fallback — the chart is never the only way to read this. */}
      <table className="w-full">
        <caption className="sr-only">{daily.title}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="text-caption text-text-muted p-2 text-start">
              {daily.colDay}
            </th>
            <th scope="col" className="text-caption text-text-muted p-2 text-end">
              {daily.seriesLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.day} className="border-border border-b last:border-0">
              <td className="text-small text-text p-2">
                <span className="ltr-isolate">
                  {format(parseISO(row.day), 'd/M/yyyy', { locale: he })}
                </span>
              </td>
              <td className="text-small text-text p-2 text-end tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

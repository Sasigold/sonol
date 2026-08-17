import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/common/EmptyState';
import { fields, labels, states } from '@/lib/copy';
import type { UserStat } from '@/hooks/useDashboard';

/**
 * Stations completed per worker.
 *
 * A horizontal bar chart, per the brief — on a phone the worker names sit on
 * one axis and never collide, which a pie's leader lines cannot promise.
 *
 * ONE hue, not a categorical palette. The bars encode a single measure across
 * entities, so giving each worker its own colour would imply they are separate
 * series and would make the colour carry no information the length does not
 * already carry. It also keeps the reserved status colours free: green here
 * means "done" everywhere else in this app, and reusing it for "worker 3"
 * would break that.
 *
 * Identity is therefore never colour-alone — it is the axis label, plus a
 * direct value at the end of each bar, plus the table below.
 */
/**
 * The category tick, drawn by hand.
 *
 * Recharts anchors a right-hand axis tick AT the axis line, and an SVG text
 * run in Hebrew then grows LEFTWARD from that anchor — straight over the bars.
 * Placing the text box with `direction: ltr` and `text-anchor: start` pins its
 * left edge to the axis instead, so it extends into the axis gutter where it
 * belongs. The Hebrew glyphs inside still order right-to-left; only the box
 * placement changes.
 */
function WorkerTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  return (
    <text
      x={x + 8}
      y={y}
      dy={4}
      textAnchor="start"
      style={{ direction: 'ltr' }}
      fill="var(--text-muted)"
      fontSize={13}
    >
      {payload?.value ?? ''}
    </text>
  );
}

export function WorkerChart({ stats }: { stats: UserStat[] }) {
  const data = stats
    .filter((stat) => (stat.stations_completed_now ?? 0) > 0)
    .map((stat) => ({
      name: stat.display_name ?? '—',
      value: stat.stations_completed_now ?? 0,
    }));

  if (data.length === 0) {
    return <EmptyState title={states.noCompletedStations} />;
  }

  // 44px a row keeps the 8px inter-bar gap the mark spec asks for while
  // leaving the bars thin.
  const height = Math.max(160, data.length * 44 + 24);

  return (
    <div className="flex flex-col gap-4">
      <div style={{ blockSize: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            {/* `reversed` + the category axis on the right makes the bars grow
                right-to-left, which is the reading direction of this app. */}
            <XAxis type="number" reversed hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="name"
              orientation="right"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={<WorkerTick />}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-alt)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text)',
                direction: 'rtl',
              }}
              formatter={(value) => [String(value ?? 0), labels.done]}
            />
            {/* One fill for every bar — a single measure, so per-bar colour
                would carry no information the length does not already carry. */}
            {/* No per-bar number: with the table directly below, a label on
                every bar is redundant and collides at small widths. The value
                is available on hover and in the table. */}
            <Bar
              dataKey="value"
              fill="var(--primary)"
              // Rounded only at the data end; the baseline end stays square.
              radius={[4, 0, 0, 4]}
              barSize={16}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table fallback — the chart is never the only way to read this. */}
      <table className="w-full">
        <caption className="sr-only">{fields.worker}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="text-caption text-text-muted p-2 text-start">
              {fields.worker}
            </th>
            <th scope="col" className="text-caption text-text-muted p-2 text-end">
              {labels.done}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name} className="border-border border-b last:border-0">
              <td className="text-small text-text p-2">{row.name}</td>
              <td className="text-small text-text p-2 text-end tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

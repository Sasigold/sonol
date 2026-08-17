import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ProgressBar } from '@/components/common/ProgressBar';
import { fields, labels } from '@/lib/copy';
import { cn } from '@/lib/utils';
import type { AreaStat } from '@/hooks/useDashboard';

type SortKey = 'area_name' | 'total_regular' | 'total_super' | 'total_flyers' | 'remaining_count';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'area_name', label: fields.area, numeric: false },
  { key: 'total_regular', label: fields.fuelRegular, numeric: true },
  { key: 'total_super', label: fields.fuelSuper, numeric: true },
  { key: 'total_flyers', label: fields.flyers, numeric: true },
  { key: 'remaining_count', label: labels.remainingShort, numeric: true },
];

export function AreaTable({ stats }: { stats: AreaStat[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'area_name',
    desc: false,
  });

  const rows = useMemo(() => {
    const copy = [...stats];
    copy.sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left ?? '').localeCompare(String(right ?? ''), 'he');
      }
      return (left ?? 0) - (right ?? 0);
    });
    return sort.desc ? copy.reverse() : copy;
  }, [stats, sort]);

  function toggle(key: SortKey) {
    setSort((current) => ({ key, desc: current.key === key ? !current.desc : false }));
  }

  return (
    <>
      {/*
        On narrow screens this becomes stacked cards rather than a table that
        scrolls sideways — a horizontally scrolling table is unusable
        one-handed, and the brief rules it out.
      */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => {
          const done = row.done_count ?? 0;
          const total = row.station_count ?? 0;
          return (
            <li
              key={row.area_id}
              className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-h3 text-text">{row.area_name}</span>
                <span className="text-small text-text-muted">
                  {labels.remaining(row.remaining_count ?? 0)}
                </span>
              </div>
              <ProgressBar done={done} total={total} label={row.area_name ?? ''} />
              <dl className="grid grid-cols-3 gap-2">
                <Cell label={fields.fuelRegular} value={row.total_regular ?? 0} />
                <Cell label={fields.fuelSuper} value={row.total_super ?? 0} />
                <Cell label={fields.flyers} value={row.total_flyers ?? 0} />
              </dl>
            </li>
          );
        })}
      </ul>

      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-border border-b">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('p-2', column.numeric ? 'text-end' : 'text-start')}
              >
                <button
                  type="button"
                  onClick={() => {
                    toggle(column.key);
                  }}
                  aria-sort={
                    sort.key === column.key ? (sort.desc ? 'descending' : 'ascending') : 'none'
                  }
                  className="text-caption text-text-muted hover:text-text inline-flex items-center gap-1"
                >
                  {column.label}
                  {sort.key === column.key ? (
                    sort.desc ? (
                      <ArrowDown className="size-4" aria-hidden />
                    ) : (
                      <ArrowUp className="size-4" aria-hidden />
                    )
                  ) : null}
                </button>
              </th>
            ))}
            <th scope="col" className="text-caption text-text-muted p-2 text-start">
              {labels.done}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.area_id} className="border-border border-b last:border-0">
              <td className="text-small text-text p-2">{row.area_name}</td>
              <td className="text-small text-text p-2 text-end tabular-nums">
                {row.total_regular ?? 0}
              </td>
              <td className="text-small text-text p-2 text-end tabular-nums">
                {row.total_super ?? 0}
              </td>
              <td className="text-small text-text p-2 text-end tabular-nums">
                {row.total_flyers ?? 0}
              </td>
              <td className="text-small text-text p-2 text-end tabular-nums">
                {row.remaining_count ?? 0}
              </td>
              <td className="w-1/4 p-2">
                <ProgressBar
                  done={row.done_count ?? 0}
                  total={row.station_count ?? 0}
                  label={row.area_name ?? ''}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-body-strong text-text tabular-nums">{value}</dd>
    </div>
  );
}

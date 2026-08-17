import { useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAnomalousLegs, useWorkerPace, type CompletionGap } from '@/hooks/useDashboard';
import { formatDuration } from '@/lib/format';
import { pace, states } from '@/lib/copy';

/**
 * A worker needs at least this many legs before "three times the median" says
 * anything: a median taken over two or three legs is itself noise, and one slow
 * leg would flag the whole worker. Below the bar we show a caption instead of a
 * count. The view still computes `is_anomaly` for every leg — the suppression
 * is a display choice, kept in one place here.
 */
const MIN_LEGS = 4;

/**
 * Pace between stations for the open round (§ F1).
 *
 * Owns its own four states so a failure here cannot blank the rest of the
 * dashboard — it is mounted as a sibling section, outside the page's shared
 * pending/error gate.
 */
export function PaceSection({ roundId }: { roundId: string | null }) {
  const paceStats = useWorkerPace(roundId);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const legs = useAnomalousLegs(roundId, showAnomalies);

  const rows = paceStats.data ?? [];
  const reliable = new Set(
    rows.filter((row) => (row.leg_count ?? 0) >= MIN_LEGS).map((row) => row.user_id),
  );
  const totalAnomalies = rows
    .filter((row) => (row.leg_count ?? 0) >= MIN_LEGS)
    .reduce((sum, row) => sum + (row.anomaly_count ?? 0), 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-text">{pace.title}</h2>
        <p className="text-small text-text-muted">{pace.intro}</p>
      </div>

      {paceStats.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : null}

      {paceStats.isError ? (
        <ErrorState
          onRetry={() => {
            void paceStats.refetch();
          }}
        />
      ) : null}

      {paceStats.data ? (
        rows.length === 0 ? (
          <EmptyState title={pace.empty.title} description={pace.empty.body} />
        ) : (
          <>
            <table className="w-full">
              <caption className="sr-only">{pace.title}</caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="text-caption text-text-muted p-2 text-start">
                    {pace.colWorker}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-end">
                    {pace.colMedian}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-end">
                    {pace.colMax}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-end">
                    {pace.colAnomalies}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const enough = (row.leg_count ?? 0) >= MIN_LEGS;
                  return (
                    <tr
                      key={row.user_id ?? row.user_name ?? ''}
                      className="border-border border-b last:border-0"
                    >
                      <td className="text-small text-text p-2">{row.user_name ?? ''}</td>
                      <td className="text-small text-text p-2 text-end">
                        <span className="ltr-isolate">
                          {formatDuration(row.median_gap_seconds ?? 0)}
                        </span>
                      </td>
                      <td className="text-small text-text p-2 text-end">
                        <span className="ltr-isolate">
                          {formatDuration(row.max_gap_seconds ?? 0)}
                        </span>
                      </td>
                      <td className="text-small text-text p-2 text-end tabular-nums">
                        {enough ? (
                          (row.anomaly_count ?? 0)
                        ) : (
                          <span className="text-caption text-text-muted">{pace.fewLegs}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalAnomalies > 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnomalies((open) => !open);
                  }}
                  aria-expanded={showAnomalies}
                  className="flex items-center gap-2 text-start"
                >
                  {/* Vertical chevrons — nothing to mirror in RTL. */}
                  {showAnomalies ? (
                    <ChevronUp className="text-text-muted size-5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="text-text-muted size-5 shrink-0" aria-hidden />
                  )}
                  <span className="text-body-strong text-text">{pace.showAnomalies}</span>
                </button>

                {showAnomalies ? (
                  <AnomalyList
                    legs={legs.data ?? []}
                    reliable={reliable}
                    isPending={legs.isPending}
                    isError={legs.isError}
                    onRetry={() => {
                      void legs.refetch();
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

function AnomalyList({
  legs,
  reliable,
  isPending,
  isError,
  onRetry,
}: {
  legs: readonly CompletionGap[];
  reliable: ReadonlySet<string | null>;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">{states.loading}</span>
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={onRetry} />;

  // Keep the list consistent with the table: only legs of workers whose median
  // we trusted enough to show a count for.
  const shown = legs.filter((leg) => reliable.has(leg.user_id));
  if (shown.length === 0) {
    return <p className="text-small text-text-muted">{pace.empty.title}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-muted">{pace.anomalyHint}</p>
      <ul className="flex flex-col gap-2">
        {shown.map((leg, index) => (
          <li
            key={`${leg.user_id ?? ''}-${leg.completed_at ?? index}`}
            className="border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2 last:border-0 last:pb-0"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-small text-text truncate">{leg.user_name ?? ''}</span>
              <span className="text-caption text-text-muted truncate">
                {pace.anomalyLeg(leg.from_station_name ?? '', leg.to_station_name ?? '')}
              </span>
            </span>
            <span className="flex items-baseline gap-3">
              <span className="text-body-strong text-text">
                <span className="ltr-isolate">{formatDuration(leg.gap_seconds ?? 0)}</span>
              </span>
              {leg.completed_at ? (
                <span className="text-caption text-text-muted ltr-isolate">
                  {format(new Date(leg.completed_at), 'HH:mm', { locale: he })}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

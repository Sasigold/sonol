import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useFarCompletions } from '@/hooks/useDashboard';
import { formatDistance } from '@/lib/format';
import { location, states } from '@/lib/copy';

/**
 * Completions that stand more than 500m from their station (§ F4).
 *
 * Owns its own four states so a failure here never blanks the rest of the
 * dashboard — mounted as a sibling section, outside the page's shared gate.
 * Only completions with a captured position and a station that has coordinates
 * can be judged, so an empty list means "nothing suspicious", not "no data".
 */
export function LocationSection({ roundId }: { roundId: string | null }) {
  const far = useFarCompletions(roundId);
  const rows = far.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-text">{location.title}</h2>
        <p className="text-small text-text-muted">{location.intro}</p>
      </div>

      {far.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : null}

      {far.isError ? (
        <ErrorState
          onRetry={() => {
            void far.refetch();
          }}
        />
      ) : null}

      {far.data ? (
        rows.length === 0 ? (
          <EmptyState title={location.empty.title} description={location.empty.body} />
        ) : (
          <table className="w-full">
            <caption className="sr-only">{location.title}</caption>
            <thead>
              <tr className="border-border border-b">
                <th scope="col" className="text-caption text-text-muted p-2 text-start">
                  {location.colWorker}
                </th>
                <th scope="col" className="text-caption text-text-muted p-2 text-start">
                  {location.colStation}
                </th>
                <th scope="col" className="text-caption text-text-muted p-2 text-end">
                  {location.colDistance}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.station_id ?? ''}-${row.completed_at ?? index}`}
                  className="border-border border-b last:border-0"
                >
                  <td className="text-small text-text p-2">{row.user_name ?? ''}</td>
                  <td className="text-small text-text p-2">
                    <span className="flex flex-col">
                      <span>{row.station_name ?? ''}</span>
                      {row.completed_at ? (
                        <span className="text-caption text-text-muted ltr-isolate">
                          {format(new Date(row.completed_at), 'd/M HH:mm', { locale: he })}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="text-small text-danger p-2 text-end">
                    <span className="ltr-isolate">{formatDistance(row.distance_m ?? 0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </section>
  );
}

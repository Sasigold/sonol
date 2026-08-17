import { MapPinned } from 'lucide-react';
import { AreaCard } from '@/components/areas/AreaCard';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useMyAreas } from '@/hooks/useAreas';
import { greeting } from '@/lib/format';
import { labels, states } from '@/lib/copy';

export function HomePage() {
  const { state } = useAuth();
  const { data: areas, isPending, isError, refetch } = useMyAreas();

  const name = state.status === 'signedIn' ? state.profile.display_name : '';

  // Totals across the user's own areas. Summed from the view's per-area
  // aggregates — the client never counts stations itself (defect 20).
  const done = areas?.reduce((sum, area) => sum + (area.done_count ?? 0), 0) ?? 0;
  const total = areas?.reduce((sum, area) => sum + (area.station_count ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-text">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
      </header>

      {isPending ? <HomeSkeleton /> : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {areas ? (
        areas.length === 0 ? (
          // Defect 16: a user with no areas used to get an infinite spinner.
          // No retry button here — retrying will not assign them an area.
          <EmptyState
            icon={MapPinned}
            title={states.noAreasAssigned.title}
            description={states.noAreasAssigned.body}
          />
        ) : (
          <>
            <section className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-body-strong text-text">{labels.roundProgress(done, total)}</p>
              <ProgressBar done={done} total={total} label={labels.roundProgress(done, total)} />
            </section>

            <ul className="flex flex-col gap-3">
              {areas.map((area) => (
                <li key={area.area_id}>
                  <AreaCard area={area} />
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">{states.loading}</span>
      <Skeleton className="h-12 w-full rounded-lg" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

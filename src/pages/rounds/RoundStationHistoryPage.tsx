import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { StationHistoryTable } from '@/components/rounds/StationHistoryTable';
import { useRoundStat } from '@/hooks/useRounds';
import { fields, history as copy, labels, nav, states } from '@/lib/copy';

/** Dates are Latin runs inside Hebrew — the caller wraps them in `.ltr-isolate`. */
function formatDate(value: string | null): string {
  if (!value) return '';
  return format(new Date(value), 'd/M/yyyy HH:mm', { locale: he });
}

/**
 * The per-station drill-down for one round — who completed each station, when,
 * and (if captured) where. Reached from a round card on `RoundsPage`.
 *
 * A separate route rather than an inline expansion: this table can run to
 * hundreds of rows for a full round, so it gets its own scroll and its own
 * loading state instead of living inside the round list's accordion.
 */
export function RoundStationHistoryPage() {
  const { roundId = null } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const round = useRoundStat(roundId);
  const isOpen = round.data ? round.data.ended_at === null : false;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate('/rounds');
          }}
          aria-label={nav.back}
        >
          {/* "Back" in RTL points right. */}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <h1 className="text-h1 text-text truncate">
              {round.data?.label ?? copy.stationsTitle}
            </h1>
            {isOpen ? <Badge variant="info">{fields.roundOpen}</Badge> : null}
          </span>
          {round.data?.first_completed_at && round.data.last_completed_at ? (
            <p className="text-caption text-text-muted">
              {labels.workSpan}{' '}
              <span className="ltr-isolate">
                {formatDate(round.data.first_completed_at)} –{' '}
                {formatDate(round.data.last_completed_at)}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      {round.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          <Skeleton className="h-8 w-1/2 rounded-md" />
        </div>
      ) : null}

      {round.isError ? (
        <ErrorState
          onRetry={() => {
            void round.refetch();
          }}
        />
      ) : null}

      <StationHistoryTable roundId={roundId} />
    </div>
  );
}

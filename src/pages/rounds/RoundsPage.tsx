import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ArrowRight, ChevronDown, ChevronUp, Download, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useRoundStats, useRoundUserStats, type RoundStat } from '@/hooks/useRounds';
import { downloadCsv, toCsv } from '@/lib/csv';
import { actions, fields, history as copy, labels, nav, states } from '@/lib/copy';

/** Dates are Latin runs inside Hebrew — the caller wraps them in `.ltr-isolate`. */
function formatDate(value: string | null): string {
  if (!value) return '';
  return format(new Date(value), 'd/M/yyyy HH:mm', { locale: he });
}

/**
 * Round history — the read side of `rounds` and `station_completions`.
 *
 * Both tables have been written since 0001 and read by nothing: closing a
 * round put its numbers permanently out of reach of the app, which made the
 * "the reset is no longer destructive" claim true of the database and false of
 * the product.
 */
export function RoundsPage() {
  const navigate = useNavigate();
  const rounds = useRoundStats();
  const [openId, setOpenId] = useState<string | null>(null);

  function exportCsv() {
    if (!rounds.data) return;
    const csv = toCsv(
      [fields.round, fields.startedAt, fields.endedAt, labels.done, fields.worker],
      rounds.data.map((round) => [
        round.label,
        formatDate(round.started_at),
        round.ended_at ? formatDate(round.ended_at) : labels.stillOpen,
        round.completed_count,
        round.worker_count,
      ]),
    );
    downloadCsv('sonol-rounds.csv', csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate('/dashboard');
            }}
            aria-label={nav.back}
          >
            {/* "Back" in RTL points right. */}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-h1 text-text truncate">{nav.history}</h1>
        </div>

        {rounds.data && rounds.data.length > 0 ? (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-5" aria-hidden />
            {actions.exportHistory}
          </Button>
        ) : null}
      </header>

      <p className="text-small text-text-muted">{copy.intro}</p>

      {rounds.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {rounds.isError ? (
        <ErrorState
          onRetry={() => {
            void rounds.refetch();
          }}
        />
      ) : null}

      {rounds.data ? (
        rounds.data.length === 0 ? (
          <EmptyState
            icon={History}
            title={states.noRounds.title}
            description={states.noRounds.body}
            action={
              <Button asChild variant="outline">
                <Link to="/dashboard">{nav.dashboard}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {/* The view's columns are all nullable to the type generator, so
                the index backs up an id that is in fact never null. */}
            {rounds.data.map((round, index) => (
              <li key={round.round_id ?? index}>
                <RoundCard
                  round={round}
                  open={openId !== null && openId === round.round_id}
                  onToggle={() => {
                    setOpenId((current) => (current === round.round_id ? null : round.round_id));
                  }}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function RoundCard({
  round,
  open,
  onToggle,
}: {
  round: RoundStat;
  open: boolean;
  onToggle: () => void;
}) {
  // Only the opened round fetches its breakdown.
  const users = useRoundUserStats(open ? round.round_id : null);
  const isOpen = round.ended_at === null;

  return (
    <div className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3 text-start"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="text-body-strong text-text truncate">{round.label}</span>
            {/* An open round is marked with a label, never colour alone. */}
            {isOpen ? <Badge variant="info">{fields.roundOpen}</Badge> : null}
          </span>
          <span className="text-caption text-text-muted ltr-isolate">
            {formatDate(round.started_at)}
            {round.ended_at ? ` – ${formatDate(round.ended_at)}` : ''}
          </span>
          <span className="text-caption text-text-muted">
            {labels.roundCompletions(round.completed_count ?? 0)} ·{' '}
            {labels.roundWorkers(round.worker_count ?? 0)}
          </span>
        </span>

        {/* Vertical chevrons — nothing to mirror in RTL. */}
        {open ? (
          <ChevronUp className="text-text-muted size-5 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="text-text-muted size-5 shrink-0" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <h2 className="text-caption text-text-muted">{copy.perWorker}</h2>

          {users.isPending ? (
            <div aria-busy="true">
              <span className="sr-only">{states.loading}</span>
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : null}

          {users.isError ? (
            <ErrorState
              onRetry={() => {
                void users.refetch();
              }}
            />
          ) : null}

          {users.data ? (
            users.data.length === 0 ? (
              <p className="text-small text-text-muted">{states.noCompletedStations}</p>
            ) : (
              <dl className="flex flex-col gap-2">
                {users.data.map((row) => (
                  <div
                    key={`${round.round_id ?? ''}-${row.user_id ?? ''}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    {/* The denormalised snapshot: still readable after the
                        account has been deleted. */}
                    <dt className="text-small text-text truncate">{row.user_name ?? ''}</dt>
                    <dd className="text-body-strong text-text tabular-nums">
                      {row.completed_count ?? 0}
                    </dd>
                  </div>
                ))}
              </dl>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

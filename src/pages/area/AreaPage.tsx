import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, ArrowUpDown, PackageCheck, Search, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StationCard } from '@/components/stations/StationCard';
import { useAuth } from '@/contexts/auth-context';
import { useMyAreas } from '@/hooks/useAreas';
import {
  filterStations,
  nextStationId,
  splitStations,
  useAreaStations,
  useSetMarkers,
  useToggleStation,
  type Station,
} from '@/hooks/useStations';
import { useRealtimeStations } from '@/hooks/useRealtimeStations';
import { useSortDirection } from '@/hooks/useSortDirection';
import { navigateToStation } from '@/lib/waze';
import { toHebrewError } from '@/lib/errors';
import { actions, dialogs, labels, nav, states, toasts } from '@/lib/copy';

type PendingDialog =
  | { kind: 'complete'; station: Station }
  | { kind: 'uncomplete'; station: Station }
  | { kind: 'navigate'; station: Station }
  | null;

export function AreaPage() {
  const { areaId } = useParams<{ areaId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const isAdmin = state.status === 'signedIn' && state.profile.is_admin;

  const { data: stations, isPending, isError, refetch } = useAreaStations(areaId);
  const { data: areas } = useMyAreas();
  const { descending, toggle } = useSortDirection(areaId);
  const toggleStation = useToggleStation(areaId ?? '');
  const setMarkers = useSetMarkers(areaId ?? '');

  // One channel for this area — not one per tab (defect 21).
  useRealtimeStations(areaId);

  const [dialog, setDialog] = useState<PendingDialog>(null);

  const [search, setSearch] = useState('');

  const areaName = areas?.find((area) => area.area_id === areaId)?.area_name ?? '';
  const { notDone, done } = useMemo(
    () => splitStations(filterStations(stations ?? [], search), descending),
    [stations, search, descending],
  );
  // Derived from sort_number over EVERY station, not the display order and not
  // the search result — neither flipping the sort nor typing in the search box
  // may silently redefine which station is "next".
  const nextId = useMemo(() => nextStationId(stations ?? []), [stations]);
  const doneTotal = useMemo(
    () => (stations ?? []).filter((station) => station.is_done).length,
    [stations],
  );

  function runNavigate(station: Station) {
    const opened = navigateToStation(station.latitude, station.longitude);
    if (!opened) toast.error(states.noStationLocation);
  }

  function handleNavigate(station: Station) {
    if (nextId !== null && station.id !== nextId) {
      setDialog({ kind: 'navigate', station });
      return;
    }
    runNavigate(station);
  }

  function confirmDialog() {
    if (!dialog) return;

    if (dialog.kind === 'navigate') {
      const { station } = dialog;
      setDialog(null);
      runNavigate(station);
      return;
    }

    const done = dialog.kind === 'complete';
    toggleStation.mutate(
      { station: dialog.station, done },
      {
        onSuccess: () => {
          toast.success(done ? toasts.stationCompleted : toasts.stationUncompleted);
        },
        onError: (error) => {
          toast.error(toHebrewError(error));
        },
      },
    );
    setDialog(null);
  }

  const cardHandlers = (station: Station) => ({
    onComplete: () => {
      setDialog({ kind: 'complete', station });
    },
    onUncomplete: () => {
      setDialog({ kind: 'uncomplete', station });
    },
    onNavigate: () => {
      handleNavigate(station);
    },
    onToggleEnvelope: () => {
      setMarkers.mutate(
        { stationId: station.id, hasEnvelope: !station.has_envelope },
        {
          onError: (error) => {
            toast.error(toHebrewError(error));
          },
        },
      );
    },
    onToggleFlyers: () => {
      setMarkers.mutate(
        { stationId: station.id, hasFlyersNote: !station.has_flyers_note },
        {
          onError: (error) => {
            toast.error(toHebrewError(error));
          },
        },
      );
    },
    onEdit: () => {
      navigate(`/stations/${station.id}/edit`);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate('/');
            }}
            aria-label={nav.back}
          >
            {/* "Back" in RTL points right. */}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-h1 text-text truncate">{areaName}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The area's progress, NOT the search result's — a filtered list
              must not make it look like stations went away. */}
          <span className="text-small text-text-muted ltr-isolate">
            {doneTotal}/{stations?.length ?? 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={actions.toggleSort}
            aria-pressed={descending}
          >
            <ArrowUpDown className="size-5" aria-hidden />
          </Button>
        </div>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {stations ? (
        stations.length === 0 ? (
          <EmptyState
            title={states.noStationsInArea.title}
            description={isAdmin ? states.noStationsInArea.body : undefined}
            action={
              isAdmin ? (
                <Button
                  onClick={() => {
                    navigate('/stations/new');
                  }}
                >
                  {nav.addStation}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Search sits above the tabs so it filters both of them. */}
            <div className="relative flex items-center">
              <Search
                className="text-text-muted pointer-events-none absolute start-4 size-5"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                aria-label={actions.searchStations}
                placeholder={actions.searchStations}
                className="ps-12 pe-12"
              />
              {search.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                  }}
                  aria-label={actions.clearSearch}
                  className="text-text-muted hover:text-text absolute end-0 flex size-12 items-center justify-center"
                >
                  <X className="size-5" aria-hidden />
                </button>
              ) : null}
            </div>

            {search.trim().length > 0 ? (
              <p className="text-caption text-text-muted" role="status">
                {labels.searchResults(notDone.length + done.length)}
              </p>
            ) : null}

            {notDone.length + done.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={states.noSearchResults.title}
                description={states.noSearchResults.body}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                    }}
                  >
                    {actions.clearSearch}
                  </Button>
                }
              />
            ) : (
              <Tabs defaultValue="notDone">
                <TabsList>
                  <TabsTrigger value="notDone">{labels.tabNotDone(notDone.length)}</TabsTrigger>
                  <TabsTrigger value="done">{labels.tabDone(done.length)}</TabsTrigger>
                </TabsList>

                <TabsContent value="notDone">
                  {notDone.length === 0 ? (
                    <EmptyState icon={PackageCheck} title={labels.tabNotDone(0)} />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {notDone.map((station) => (
                        <li key={station.id}>
                          <StationCard
                            station={station}
                            isNext={station.id === nextId}
                            isAdmin={isAdmin}
                            {...cardHandlers(station)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="done">
                  {done.length === 0 ? (
                    <EmptyState icon={PackageCheck} title={states.noCompletedStations} />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {done.map((station) => (
                        <li key={station.id}>
                          <StationCard
                            station={station}
                            isNext={false}
                            isAdmin={isAdmin}
                            {...cardHandlers(station)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )
      ) : null}

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={
          dialog?.kind === 'navigate'
            ? dialogs.navigateWarning.title
            : dialog?.kind === 'uncomplete'
              ? dialogs.confirmUncomplete.title
              : dialogs.confirmComplete.title
        }
        description={
          dialog?.kind === 'navigate'
            ? dialogs.navigateWarning.body
            : dialog?.kind === 'uncomplete'
              ? dialogs.confirmUncomplete.body(dialog.station.name)
              : dialog
                ? dialogs.confirmComplete.body(dialog.station.name)
                : ''
        }
        confirmLabel={dialog?.kind === 'navigate' ? actions.navigateAnyway : actions.confirm}
        destructive={dialog?.kind === 'uncomplete'}
        pending={toggleStation.isPending}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

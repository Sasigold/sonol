import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useGeolocationCapture, type CapturedPosition } from '@/hooks/useGeolocationCapture';
import { navigateToStation } from '@/lib/waze';
import { distanceMeters, isFarFromStation } from '@/lib/geo';
import { formatDistance, minutesSince } from '@/lib/format';
import { toHebrewError } from '@/lib/errors';
import { actions, dialogs, labels, nav, states, toasts } from '@/lib/copy';

/**
 * Reasons a completion is flagged before it is recorded — either, both, or
 * neither. When neither is set the confirm is the plain one; when either is,
 * the dialog switches to the warning tone and `completeDialogBody` composes the
 * matching line(s).
 */
interface CompletionWarnings {
  /** A previous completion within the window — a possible fat-finger double-tap. */
  rapid?: { prevName: string; minutesAgo: number };
  /** The captured position is beyond the distance threshold from the station. */
  far?: { meters: number };
}

type PendingDialog =
  | {
      kind: 'complete';
      station: Station;
      // Captured when the worker tapped (onComplete), so the distance warning
      // and the position recorded on confirm are the same fix. Carried here into
      // the mutation rather than re-captured at confirm.
      coords: CapturedPosition | null;
      warnings: CompletionWarnings;
    }
  | { kind: 'uncomplete'; station: Station }
  | { kind: 'navigate'; station: Station }
  | null;

/**
 * How recent a previous completion must be for the next one to prompt a "did
 * you mean to?" warning. A fat-finger double-tap happens in seconds; a genuine
 * back-to-back pair at two adjacent pumps is still well under this.
 */
const RAPID_WINDOW_MS = 2 * 60_000;

/**
 * How far the worker may be from a station before completing it raises a
 * warning (§ request). Deliberately tighter than the admin's 500m review flag
 * on the station card: this one fires in the worker's own hand to catch a
 * wrong-station tap, where a false alarm costs only a second glance. The GPS
 * fix's own accuracy is forgiven on top of it — see `isFarFromStation`.
 */
const FAR_WARNING_THRESHOLD_M = 100;

/** Whether a completion carries either warning, so the dialog switches tone. */
function completionWarned(warnings: CompletionWarnings): boolean {
  return warnings.far !== undefined || warnings.rapid !== undefined;
}

/**
 * The confirm body for a completion: the plain question when nothing is off, or
 * the active warning line(s) followed by the closing question. Distance and
 * previous-station facts are both worker-facing, so this runs for everyone, not
 * only admins.
 */
function completeDialogBody(station: Station, warnings: CompletionWarnings): string {
  const lines: string[] = [];
  if (warnings.far) {
    lines.push(dialogs.completeWarning.far(formatDistance(warnings.far.meters)));
  }
  if (warnings.rapid) {
    lines.push(dialogs.completeWarning.rapid(warnings.rapid.minutesAgo, warnings.rapid.prevName));
  }
  if (lines.length === 0) return dialogs.confirmComplete.body(station.name);
  lines.push(dialogs.completeWarning.question(station.name));
  return lines.join(' ');
}

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
  // Keeps a warm GPS fix while this screen is open; read synchronously at
  // confirm time (§ location). Returns null when denied/unavailable/stale.
  const { capture } = useGeolocationCapture();

  // One channel for this area — not one per tab (defect 21).
  useRealtimeStations(areaId);

  const [dialog, setDialog] = useState<PendingDialog>(null);

  // The last completion the worker CONFIRMED on this screen — timestamp and
  // station name — for the rapid-double-completion warning. Client-only and
  // deliberately not derived from any row's `completed_at`: an optimistic row
  // carries the client clock and a refetched one the server's, and a queued tap
  // never gets a server time at all. This ref measures the worker's own taps.
  const lastCompleted = useRef<{ at: number; name: string } | null>(null);
  // The route is param-only (`/areas/:areaId`), so React Router keeps this
  // component mounted when the worker switches areas — the ref must be cleared
  // by hand, or a tap in the new area would compare against the old one.
  useEffect(() => {
    lastCompleted.current = null;
  }, [areaId]);

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

    // The position was captured when the worker tapped (onComplete) and rides
    // this dialog; a completion carries it, an uncomplete never does. It survives
    // the offline path — the queued record replays with it.
    const coords = dialog.kind === 'complete' ? dialog.coords : null;

    if (done) {
      // Recorded at confirm time, not in onSuccess: a tap made offline resolves
      // through onError, and the warning is about what the worker intended to
      // mark, not about what the server acknowledged.
      lastCompleted.current = { at: Date.now(), name: dialog.station.name };
    }

    toggleStation.mutate(
      { station: dialog.station, done, coords },
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
      // Capture once, here at the tap: the distance check below and the position
      // recorded on confirm must be the same fix. Null when denied, unavailable
      // or stale — the distance simply cannot be judged, and no far warning fires.
      const coords = capture();
      const warnings: CompletionWarnings = {};

      const previous = lastCompleted.current;
      if (previous !== null && Date.now() - previous.at < RAPID_WINDOW_MS) {
        warnings.rapid = {
          prevName: previous.name,
          minutesAgo: minutesSince(previous.at, Date.now()),
        };
      }

      const stationCoords =
        station.latitude !== null && station.longitude !== null
          ? { latitude: station.latitude, longitude: station.longitude }
          : null;
      if (coords !== null && stationCoords !== null) {
        const meters = distanceMeters(stationCoords, coords);
        if (isFarFromStation(meters, coords.accuracy, FAR_WARNING_THRESHOLD_M)) {
          warnings.far = { meters };
        }
      }

      setDialog({ kind: 'complete', station, coords, warnings });
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
              : dialog?.kind === 'complete' && completionWarned(dialog.warnings)
                ? dialogs.completeWarning.title
                : dialogs.confirmComplete.title
        }
        description={
          dialog?.kind === 'navigate'
            ? dialogs.navigateWarning.body
            : dialog?.kind === 'uncomplete'
              ? dialogs.confirmUncomplete.body(dialog.station.name)
              : dialog?.kind === 'complete'
                ? completeDialogBody(dialog.station, dialog.warnings)
                : ''
        }
        confirmLabel={dialog?.kind === 'navigate' ? actions.navigateAnyway : actions.confirm}
        destructive={dialog?.kind === 'uncomplete'}
        tone={
          dialog?.kind === 'complete' && completionWarned(dialog.warnings) ? 'warning' : 'default'
        }
        pending={toggleStation.isPending}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

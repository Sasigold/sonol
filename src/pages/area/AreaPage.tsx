import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowUpDown,
  Fuel,
  Mail,
  PackageCheck,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StationCard } from '@/components/stations/StationCard';
import { StationRow } from '@/components/stations/StationRow';
import { FarStationDialog } from '@/components/stations/FarStationDialog';
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
import { toHebrewError } from '@/lib/errors';
import { actions, dialogs, labels, nav, states, toasts } from '@/lib/copy';

type PendingDialog =
  | {
      kind: 'complete';
      station: Station;
      // Captured when the worker tapped (onComplete), so the distance check and
      // the position recorded on confirm are the same fix. Carried here into the
      // mutation rather than re-captured at confirm.
      coords: CapturedPosition | null;
      // Metres from the station when that gap is past the warning threshold, else
      // null. Non-null routes to the prominent FarStationDialog; null shows the
      // plain confirm (the worker is close enough, or the fix could not place them).
      farMeters: number | null;
    }
  | { kind: 'uncomplete'; station: Station }
  | { kind: 'navigate'; station: Station }
  | null;

/**
 * The filter chips. `super` and `envelope` narrow the OUTSTANDING stations —
 * those are the two misses that cost a drive back, and one already delivered
 * needs no attention.
 */
type Filter = 'notDone' | 'super' | 'envelope' | 'done';

/**
 * How far the worker may be from a station before completing it raises a
 * prominent warning (§ request). Deliberately tighter than the admin's 500m
 * review flag on the station card: this one fires in the worker's own hand to
 * catch a wrong-station tap, where a false alarm costs only a second glance. The
 * GPS fix's own accuracy is forgiven on top of it — see `isFarFromStation`.
 */
const FAR_WARNING_THRESHOLD_M = 100;

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

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('notDone');
  // One row open at a time: the list is for scanning, and a second open row
  // would push the first out of view anyway.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const lists: Record<Filter, Station[]> = useMemo(
    () => ({
      notDone,
      super: notDone.filter((station) => station.fuel_type === 'super'),
      envelope: notDone.filter((station) => station.has_envelope),
      done,
    }),
    [notDone, done],
  );
  const totalCount = stations?.length ?? 0;

  // A completion flagged as far from its station takes the prominent dialog;
  // everything else takes the plain confirm.
  const isFarComplete = dialog?.kind === 'complete' && dialog.farMeters !== null;

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
      // or stale — the distance simply cannot be judged, and no warning fires.
      const coords = capture();

      const stationCoords =
        station.latitude !== null && station.longitude !== null
          ? { latitude: station.latitude, longitude: station.longitude }
          : null;
      let farMeters: number | null = null;
      if (coords !== null && stationCoords !== null) {
        const meters = distanceMeters(stationCoords, coords);
        if (isFarFromStation(meters, coords.accuracy, FAR_WARNING_THRESHOLD_M)) {
          farMeters = meters;
        }
      }

      setDialog({ kind: 'complete', station, coords, farMeters });
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

  function renderRows(list: Station[]) {
    return (
      <ul className="flex flex-col gap-2">
        {list.map((station) => (
          <li key={station.id}>
            <StationRow
              station={station}
              isNext={station.id === nextId}
              isAdmin={isAdmin}
              expanded={expandedId === station.id}
              onToggleExpanded={() => {
                setExpandedId((open) => (open === station.id ? null : station.id));
              }}
              {...cardHandlers(station)}
            />
          </li>
        ))}
      </ul>
    );
  }

  function renderOutstanding() {
    if (notDone.length === 0) {
      return search.trim().length > 0 ? (
        <EmptyState icon={SearchX} title={states.noSearchResults.title} />
      ) : (
        <EmptyState
          icon={PackageCheck}
          title={states.allStationsDone.title}
          description={states.allStationsDone.body}
          action={
            <Button
              variant="outline"
              onClick={() => {
                navigate('/');
              }}
            >
              {nav.backToAreas}
            </Button>
          }
        />
      );
    }

    // The next station is lifted out into the full card at the top, whatever
    // the sort direction. It stays in its place in the list only when a search
    // has filtered it out, in which case there is no card.
    const next = notDone.find((station) => station.id === nextId);
    const rest = next ? notDone.filter((station) => station !== next) : notDone;

    return (
      <div className="flex flex-col gap-4">
        {next ? (
          <ul>
            <li>
              <StationCard station={next} isNext isAdmin={isAdmin} {...cardHandlers(next)} />
            </li>
          </ul>
        ) : null}

        {rest.length > 0 ? (
          <section className="flex flex-col gap-2" aria-labelledby="up-next">
            {next ? (
              <h2 id="up-next" className="text-small text-text-muted px-1">
                {labels.upNext(rest.length)}
              </h2>
            ) : null}
            {renderRows(rest)}
          </section>
        ) : null}
      </div>
    );
  }

  function renderFiltered(list: Station[], emptyTitle: string) {
    return list.length === 0 ? (
      <EmptyState icon={PackageCheck} title={emptyTitle} />
    ) : (
      renderRows(list)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
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

          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="text-h1 text-text truncate">{areaName}</h1>
            {/* The area's progress, NOT the search result's — a filtered list
                must not make it look like stations went away. */}
            {stations && totalCount > 0 ? (
              <p className="text-small text-text-muted">
                {labels.roundProgress(doneTotal, totalCount)}
              </p>
            ) : null}
          </div>

          <Button
            variant={searchOpen ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => {
              // Closing the search also clears it: a hidden filter would leave
              // the worker looking at a list with stations silently missing.
              if (searchOpen) setSearch('');
              setSearchOpen((open) => !open);
            }}
            aria-label={actions.openSearch}
            aria-expanded={searchOpen}
          >
            <Search className="size-5" aria-hidden />
          </Button>
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

        {stations && totalCount > 0 ? (
          <ProgressBar
            done={doneTotal}
            total={totalCount}
            label={labels.roundProgress(doneTotal, totalCount)}
          />
        ) : null}
      </header>

      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {/* The shape of the screen: the next-station card, then rows. */}
          <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          {[0, 1, 2, 3].map((row) => (
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
            {searchOpen ? (
              <div className="flex flex-col gap-2">
                {/* Search filters every chip below it. */}
                <div className="relative flex items-center">
                  <Search
                    className="text-text-muted pointer-events-none absolute start-4 size-5"
                    aria-hidden
                  />
                  <Input
                    // Opened on purpose, by a tap on the search button.
                    autoFocus
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
              </div>
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
              <Tabs
                value={filter}
                onValueChange={(value) => {
                  setFilter(value as Filter);
                  setExpandedId(null);
                }}
              >
                {/* Chips rather than a two-way switch: סופר and the envelope are
                    the two misses that cost a drive back, so each gets a
                    one-tap view of its own. Scrolls sideways on a narrow
                    phone rather than wrapping into a second row. */}
                <TabsList className="-mx-4 w-auto gap-2 overflow-x-auto rounded-none bg-transparent px-4 py-0">
                  <TabsTrigger value="notDone" className={CHIP}>
                    {labels.tabNotDone(lists.notDone.length)}
                  </TabsTrigger>
                  <TabsTrigger value="super" className={CHIP}>
                    <Fuel className="size-4" aria-hidden />
                    {labels.tabSuper(lists.super.length)}
                  </TabsTrigger>
                  <TabsTrigger value="envelope" className={CHIP}>
                    <Mail className="size-4" aria-hidden />
                    {labels.tabEnvelope(lists.envelope.length)}
                  </TabsTrigger>
                  <TabsTrigger value="done" className={CHIP}>
                    {labels.tabDone(lists.done.length)}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notDone">{renderOutstanding()}</TabsContent>
                <TabsContent value="super">
                  {renderFiltered(lists.super, states.noSuperLeft)}
                </TabsContent>
                <TabsContent value="envelope">
                  {renderFiltered(lists.envelope, states.noEnvelopeLeft)}
                </TabsContent>
                <TabsContent value="done">
                  {renderFiltered(lists.done, states.noCompletedStations)}
                </TabsContent>
              </Tabs>
            )}
          </>
        )
      ) : null}

      {/* The plain confirms — navigate, uncomplete, and a completion close
          enough to the station. A far completion is handled by its own
          prominent dialog below, so it is excluded here. */}
      <ConfirmDialog
        open={dialog !== null && !isFarComplete}
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
              : dialog?.kind === 'complete'
                ? dialogs.confirmComplete.body(dialog.station.name)
                : ''
        }
        confirmLabel={dialog?.kind === 'navigate' ? actions.navigateAnyway : actions.confirm}
        destructive={dialog?.kind === 'uncomplete'}
        pending={toggleStation.isPending}
        onConfirm={confirmDialog}
      />

      {/* Far from the station: the big, deliberately-different warning. */}
      <FarStationDialog
        open={isFarComplete}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        stationName={dialog?.kind === 'complete' ? dialog.station.name : ''}
        meters={dialog?.kind === 'complete' ? (dialog.farMeters ?? 0) : 0}
        pending={toggleStation.isPending}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

/** A filter chip: the tab trigger, reshaped into a pill that fills when active. */
const CHIP =
  'border-border bg-surface flex-none gap-1 rounded-full border px-3 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground';

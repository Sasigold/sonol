import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { toggleStationRpc } from '@/lib/rpc';
import { offlineQueue } from '@/lib/offline-queue';
import { classifyMutationError } from '@/lib/errors';
import type { CapturedPosition } from '@/hooks/useGeolocationCapture';

export type Station = Tables<'stations'>;

export const stationKeys = {
  byArea: (areaId: string) => ['stations', areaId] as const,
  one: (id: string) => ['station', id] as const,
};

/**
 * Every station in an area, in ONE query.
 *
 * The not-done and done tabs are derived on the client from this single result
 * rather than issued as two queries: they are two views of the same small set,
 * and the tab counts must agree with the lists at all times. Defect 21 was the
 * area screen opening four or five concurrent listeners for the same data.
 */
export function useAreaStations(areaId: string | undefined) {
  return useQuery({
    queryKey: stationKeys.byArea(areaId ?? ''),
    enabled: Boolean(areaId),
    queryFn: async (): Promise<Station[]> => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('area_id', areaId ?? '')
        .order('sort_number', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useStation(id: string | undefined) {
  return useQuery({
    queryKey: stationKeys.one(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Station> => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('id', id ?? '')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Filter an area's stations by name or station number.
 *
 * An area can hold forty stations, and the person scrolling them is holding a
 * phone one-handed in a vehicle. Matching is done here rather than in a query:
 * the whole area is already loaded in one request, so a round trip per
 * keystroke would cost a worker on a bad connection everything and gain
 * nothing.
 *
 * The number is matched as a prefix — typing `12` finds 12 and 12.5 — and the
 * trailing `.00` PostgREST returns for `numeric` is dropped so `12` matches a
 * station stored as `12.00`.
 */
export function filterStations(stations: Station[], term: string): Station[] {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) return stations;

  return stations.filter((station) => {
    if (station.name.toLowerCase().includes(needle)) return true;
    // `String(12.5)` is "12.5" and `String(12)` is "12" — no formatting needed.
    return String(station.sort_number).startsWith(needle);
  });
}

/** Split into the two tabs. `sort_number` ascending, flipped by the toggle. */
export function splitStations(stations: Station[], descending: boolean) {
  const notDone = stations
    .filter((station) => !station.is_done)
    .sort((a, b) => (descending ? b.sort_number - a.sort_number : a.sort_number - b.sort_number));

  const done = stations
    .filter((station) => station.is_done)
    // Most recently completed first (§8.5).
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  return { notDone, done };
}

/**
 * The "next" station is the lowest `sort_number` still outstanding — computed
 * from the data, NOT from whatever is currently first on screen.
 *
 * The brief says the הבא badge and the wrong-station warning key off "the first
 * in the list", but the list has a sort toggle. Tying them to display order
 * would mean reversing the sort silently redefines which station is next, and
 * the warning would fire on the correct one.
 */
export function nextStationId(stations: Station[]): string | null {
  const outstanding = stations.filter((station) => !station.is_done);
  if (outstanding.length === 0) return null;
  return outstanding.reduce((lowest, station) =>
    station.sort_number < lowest.sort_number ? station : lowest,
  ).id;
}

interface CompletionContext {
  previous: Station[] | undefined;
  /** Set by `onError` when the tap went to the offline queue instead. */
  queued: boolean;
}

/**
 * Complete / uncomplete, optimistically.
 *
 * Both go through the RPCs — the client never writes `is_done`, `completed_by`
 * or the counter itself, and the column grants would refuse it anyway. The
 * uncomplete RPC decrements the ORIGINAL completer, which the original app got
 * wrong (defect 9).
 *
 * When the call fails because the connection is gone, the optimistic row is
 * KEPT and the tap is queued for replay. That is the whole point of the
 * feature: a worker in a dead spot marks stations, sees them marked, and the
 * app catches up when the signal returns.
 */
export function useToggleStation(areaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    /*
     * `always`, not the default `online`.
     *
     * TanStack Query's default is to PAUSE a mutation while the browser is
     * offline: `onMutate` runs, the request never leaves, and `onError` never
     * fires. It resumes the call on reconnect from memory — which is a queue,
     * but an in-memory one that a reload or a killed tab loses, and a phone in
     * a vehicle is exactly where that happens.
     *
     * With `always` the request is attempted, fails immediately, and lands in
     * `onError` below, where it is written to IndexedDB and survives the
     * restart. Verified in a browser: with the default, nothing ever reached
     * the queue.
     */
    networkMode: 'always',
    mutationFn: ({
      station,
      done,
      coords,
    }: {
      station: Station;
      done: boolean;
      // The worker's position at tap time, for completions only (§ location).
      coords?: CapturedPosition | null;
    }) => toggleStationRpc(station.id, done, false, coords ?? null),

    onMutate: async ({ station, done }): Promise<CompletionContext> => {
      await queryClient.cancelQueries({ queryKey: stationKeys.byArea(areaId) });
      const previous = queryClient.getQueryData<Station[]>(stationKeys.byArea(areaId));

      queryClient.setQueryData<Station[]>(stationKeys.byArea(areaId), (current) =>
        current?.map((candidate) =>
          candidate.id === station.id
            ? {
                ...candidate,
                is_done: done,
                completed_at: done ? new Date().toISOString() : null,
                completed_by: done ? candidate.completed_by : null,
                completed_by_name: done ? candidate.completed_by_name : null,
              }
            : candidate,
        ),
      );

      return { previous, queued: false };
    },

    onError: async (error, { station, done, coords }, context) => {
      if (classifyMutationError(error) === 'offline' && context) {
        // Keep the optimistic row and remember the tap. `baseline` is only
        // consulted for a station with nothing queued yet, and in that case the
        // cache still matches the server — a station already in the queue keeps
        // the baseline recorded on its first tap. The captured position rides
        // the record so a dead-zone completion is replayed with where the
        // worker actually stood, not where they reconnected.
        context.queued = true;
        await offlineQueue.enqueue({
          stationId: station.id,
          areaId,
          done,
          baseline: station.is_done,
          ...(done && coords ? { coords } : {}),
        });
        return;
      }

      // Roll the list back to exactly what it was, so a failed call cannot
      // leave the screen claiming work that did not happen.
      if (context?.previous) {
        queryClient.setQueryData(stationKeys.byArea(areaId), context.previous);
      }
    },

    onSettled: (_data, _error, _variables, context) => {
      // A queued tap must NOT invalidate: the refetch would replace the
      // optimistic row with the server's stale answer and the station would
      // un-mark itself in front of the worker. The drain invalidates instead,
      // once the write has actually landed.
      if (context?.queued) return;

      void queryClient.invalidateQueries({ queryKey: stationKeys.byArea(areaId) });
      // The counters on home and the dashboard moved too.
      void queryClient.invalidateQueries({ queryKey: ['my_areas'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Admin-only marker toggles, via the RPC (§5.2). */
export function useSetMarkers(areaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stationId,
      hasEnvelope,
      hasFlyersNote,
    }: {
      stationId: string;
      hasEnvelope?: boolean;
      hasFlyersNote?: boolean;
    }) => {
      // Omit a marker entirely rather than sending `undefined`: the RPC
      // coalesces a missing argument to the current value, and
      // `exactOptionalPropertyTypes` distinguishes "absent" from "undefined".
      const args: {
        p_station_id: string;
        p_has_envelope?: boolean;
        p_has_flyers_note?: boolean;
      } = { p_station_id: stationId };
      if (hasEnvelope !== undefined) args.p_has_envelope = hasEnvelope;
      if (hasFlyersNote !== undefined) args.p_has_flyers_note = hasFlyersNote;

      const { error } = await supabase.rpc('set_station_markers', args);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stationKeys.byArea(areaId) });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';

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
}

/**
 * Complete / uncomplete, optimistically.
 *
 * Both go through the RPCs — the client never writes `is_done`, `completed_by`
 * or the counter itself, and the column grants would refuse it anyway. The
 * uncomplete RPC decrements the ORIGINAL completer, which the original app got
 * wrong (defect 9).
 */
export function useToggleStation(areaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ station, done }: { station: Station; done: boolean }) => {
      const { error } = done
        ? await supabase.rpc('complete_station', { p_station_id: station.id })
        : await supabase.rpc('uncomplete_station', { p_station_id: station.id });
      if (error) throw error;
    },

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

      return { previous };
    },

    onError: (_error, _variables, context) => {
      // Roll the list back to exactly what it was, so a failed call cannot
      // leave the screen claiming work that did not happen.
      if (context?.previous) {
        queryClient.setQueryData(stationKeys.byArea(areaId), context.previous);
      }
    },

    onSettled: () => {
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

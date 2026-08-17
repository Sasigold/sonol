import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StationValues } from '@/lib/schemas';
import { stationKeys } from './useStations';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['stations'] });
  void queryClient.invalidateQueries({ queryKey: ['my_areas'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

/** An empty waze_link becomes NULL, so the column stays clean. */
function toRow(values: StationValues) {
  return {
    name: values.name,
    sort_number: values.sort_number,
    area_id: values.area_id,
    fuel_type: values.fuel_type,
    total: values.total,
    flyers: values.flyers,
    waze_link: values.waze_link.length > 0 ? values.waze_link : null,
  };
}

export function useCreateStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: StationValues) => {
      // latitude/longitude are deliberately absent: the parse_waze_coordinates
      // trigger derives them at write time. Sending client-parsed values would
      // create a second source of truth that could disagree with the database.
      const { error } = await supabase.from('stations').insert(toRow(values));
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}

export function useUpdateStation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: StationValues) => {
      // Completion state is untouched on purpose — editing a station must not
      // silently mark it done or undone (§8.6).
      const { error } = await supabase.from('stations').update(toRow(values)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      void queryClient.invalidateQueries({ queryKey: stationKeys.one(id) });
    },
  });
}

export function useDeleteStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}

/**
 * Async uniqueness check for (area_id, sort_number) — §8.6.
 *
 * A UNIQUE constraint sits behind this, so the check is a courtesy that turns
 * a database error into an inline message before submit rather than after.
 * `excludeId` stops a station colliding with itself while being edited.
 */
export function useStationNumberTaken(areaId: string, sortNumber: number, excludeId?: string) {
  return useQuery({
    queryKey: ['station-number', areaId, sortNumber, excludeId ?? null],
    enabled: areaId.length > 0 && Number.isFinite(sortNumber) && sortNumber > 0,
    queryFn: async (): Promise<boolean> => {
      let query = supabase
        .from('stations')
        .select('id')
        .eq('area_id', areaId)
        .eq('sort_number', sortNumber);
      if (excludeId) query = query.neq('id', excludeId);

      const { data, error } = await query.limit(1);
      if (error) throw error;
      return data.length > 0;
    },
  });
}

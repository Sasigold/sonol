import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { stationKeys } from './useStations';

/**
 * ONE realtime channel per open area — not five.
 *
 * Defect 21: the original area screen opened four or five concurrent listeners
 * for the same collection, and the dashboard opened `1 + 3 x areas`. A single
 * channel filtered server-side by `area_id` covers every change to every
 * station on screen; the handler only invalidates the query and lets TanStack
 * refetch once.
 */
export function useRealtimeStations(areaId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!areaId) return;

    const channel = supabase
      .channel(`stations:${areaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stations', filter: `area_id=eq.${areaId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: stationKeys.byArea(areaId) });
          void queryClient.invalidateQueries({ queryKey: ['my_areas'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [areaId, queryClient]);
}

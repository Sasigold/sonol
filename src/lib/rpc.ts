import { supabase } from './supabase';

/**
 * The station toggle, as one call.
 *
 * It lives here rather than inside the mutation hook because two callers need
 * exactly the same request: the optimistic mutation while the app is online,
 * and the offline queue replaying a tap made in a dead spot. Two copies would
 * be two things to keep in step.
 */
export async function toggleStationRpc(stationId: string, done: boolean): Promise<void> {
  const { error } = done
    ? await supabase.rpc('complete_station', { p_station_id: stationId })
    : await supabase.rpc('uncomplete_station', { p_station_id: stationId });
  if (error) throw error;
}

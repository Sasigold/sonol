import { supabase } from './supabase';

/**
 * The station toggle, as one call.
 *
 * It lives here rather than inside the mutation hook because two callers need
 * exactly the same request: the optimistic mutation while the app is online,
 * and the offline queue replaying a tap made in a dead spot. Two copies would
 * be two things to keep in step.
 *
 * `queued` marks the row the replay writes. A run of taps made in a dead zone
 * replays in a burst on reconnect, so their inter-completion gaps are the burst,
 * not real travel; the flag lets `completion_gaps` drop those legs. The online
 * path leaves it false. Its default is false so a still-precached PWA calling
 * the RPC without the argument keeps working.
 */
export async function toggleStationRpc(
  stationId: string,
  done: boolean,
  queued = false,
): Promise<void> {
  const { error } = done
    ? await supabase.rpc('complete_station', { p_station_id: stationId, p_queued: queued })
    : await supabase.rpc('uncomplete_station', { p_station_id: stationId, p_queued: queued });
  if (error) throw error;
}

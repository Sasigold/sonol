import { supabase } from './supabase';
import type { CapturedPosition } from '@/hooks/useGeolocationCapture';

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
 *
 * `coords` is the worker's captured position at tap time (verification, §
 * location). Only the complete path carries it; an undo has no location. Every
 * argument is defaulted so a precached PWA calling the RPC without them still
 * resolves the single overload.
 */
export async function toggleStationRpc(
  stationId: string,
  done: boolean,
  queued = false,
  coords: CapturedPosition | null = null,
): Promise<void> {
  const { error } = done
    ? await supabase.rpc('complete_station', {
        p_station_id: stationId,
        p_queued: queued,
        // Spread the coords keys only when present — under
        // exactOptionalPropertyTypes an explicit `undefined` is not a valid
        // value for the RPC's optional params.
        ...(coords
          ? {
              p_latitude: coords.latitude,
              p_longitude: coords.longitude,
              p_accuracy: coords.accuracy,
            }
          : {}),
      })
    : await supabase.rpc('uncomplete_station', { p_station_id: stationId, p_queued: queued });
  if (error) throw error;
}

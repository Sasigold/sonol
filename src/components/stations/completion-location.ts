import { distanceMeters, isFarFromStation } from '@/lib/geo';
import type { Station } from '@/hooks/useStations';

/** Metres beyond which a completion is flagged as away from its station (§ location). */
export const FAR_THRESHOLD_M = 500;

/**
 * Admin-only: how far the captured completion position is from the station's
 * own coordinates. Needs both points; distance is computed locally (the row
 * already carries both) rather than through completion_locations, which serves
 * the dashboard aggregate. Narrowed to non-null coords so no `!` is needed.
 *
 * Shared by the next-station card and the expanded station row, which show the
 * same completion details.
 */
export function completionLocation(station: Station, isAdmin: boolean) {
  const stationCoords =
    station.latitude !== null && station.longitude !== null
      ? { latitude: station.latitude, longitude: station.longitude }
      : null;
  const capturedCoords =
    station.completed_latitude !== null && station.completed_longitude !== null
      ? {
          latitude: station.completed_latitude,
          longitude: station.completed_longitude,
          accuracy: station.completed_accuracy ?? 0,
        }
      : null;
  const completionDistance =
    isAdmin && station.is_done && stationCoords !== null && capturedCoords !== null
      ? distanceMeters(stationCoords, capturedCoords)
      : null;
  const isFar = isFarFromStation(
    completionDistance,
    station.completed_accuracy ?? 0,
    FAR_THRESHOLD_M,
  );

  // A completed station with known coordinates can be shown on a map — the
  // station's location and, when it was captured, where the worker stood.
  const canShowMap = isAdmin && station.is_done && stationCoords !== null;

  return { stationCoords, capturedCoords, completionDistance, isFar, canShowMap };
}

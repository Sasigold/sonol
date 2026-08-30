import { useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StationMapDialog } from '@/components/stations/StationMapDialog';
import { useRoundStationHistory, type RoundStationHistory } from '@/hooks/useRounds';
import { formatDistance } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fields, history as copy, location, states } from '@/lib/copy';

/** Dates are Latin runs inside Hebrew — isolated at the render site. */
function formatTimestamp(value: string | null): string {
  if (!value) return '';
  return format(new Date(value), 'd/M/yyyy HH:mm', { locale: he });
}

/**
 * Every station completed in one round — who, when, and (if captured) where —
 * from `round_station_history`. Unlike the dashboard's "far from station"
 * widget, a station with no captured GPS still gets a row here rather than
 * silently vanishing: "history for every station" means every station.
 */
export function StationHistoryTable({ roundId }: { roundId: string | null }) {
  const stationHistory = useRoundStationHistory(roundId);
  const rows = stationHistory.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {stationHistory.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {stationHistory.isError ? (
        <ErrorState
          onRetry={() => {
            void stationHistory.refetch();
          }}
        />
      ) : null}

      {stationHistory.data ? (
        rows.length === 0 ? (
          <EmptyState
            title={states.noStationsInRound.title}
            description={states.noStationsInRound.body}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">{copy.stationsTitle}</caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="text-caption text-text-muted p-2 text-start">
                    {fields.stationName}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-start">
                    {location.colWorker}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-start">
                    {copy.colCompletedAt}
                  </th>
                  <th scope="col" className="text-caption text-text-muted p-2 text-end">
                    {location.colDistance}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <StationHistoryRow key={row.station_id ?? index} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}

function StationHistoryRow({ row }: { row: RoundStationHistory }) {
  const [mapOpen, setMapOpen] = useState(false);

  // Mirrors StationCard's own coordinate narrowing — the view already carries
  // both points, so no extra query is needed to feed the map dialog.
  const stationCoords =
    row.station_latitude !== null && row.station_longitude !== null
      ? { latitude: row.station_latitude, longitude: row.station_longitude }
      : null;
  const completionCoords =
    row.latitude !== null && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy ?? 0 }
      : null;
  const isFar = row.is_far === true;

  return (
    <tr className="border-border border-b last:border-0">
      <td className="text-small text-text p-2">
        <span className="flex flex-col">
          <span>{row.station_name ?? ''}</span>
          <span className="text-caption text-text-muted">{row.area_name ?? ''}</span>
        </span>
      </td>
      <td className="text-small text-text p-2">{row.user_name ?? ''}</td>
      <td className="text-small text-text-muted ltr-isolate p-2">
        {formatTimestamp(row.completed_at)}
      </td>
      <td className="p-2 text-end">
        {stationCoords ? (
          <>
            <button
              type="button"
              onClick={() => {
                setMapOpen(true);
              }}
              className={cn(
                'text-caption inline-flex flex-wrap items-center justify-end gap-1 underline-offset-2 hover:underline',
                row.distance_m !== null && isFar ? 'text-danger' : 'text-text-muted',
              )}
            >
              <MapPin className="size-4 shrink-0" aria-hidden />
              {row.distance_m !== null ? (
                <span className="ltr-isolate">{formatDistance(row.distance_m)}</span>
              ) : (
                copy.noLocation
              )}
              {/* Colour never carries the "far" state alone — the badge and its
                  own icon repeat it as text, same as StationCard. */}
              {row.distance_m !== null && isFar ? (
                <Badge variant="danger">
                  <MapPin className="size-4" aria-hidden />
                  {location.farBadge}
                </Badge>
              ) : null}
            </button>
            <StationMapDialog
              open={mapOpen}
              onOpenChange={setMapOpen}
              stationName={row.station_name ?? ''}
              station={stationCoords}
              completion={completionCoords}
              isFar={isFar}
            />
          </>
        ) : (
          <span className="text-caption text-text-muted">{copy.noLocation}</span>
        )}
      </td>
    </tr>
  );
}

import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Coordinates } from '@/lib/waze';
import type { CapturedPosition } from '@/hooks/useGeolocationCapture';
import { location, states } from '@/lib/copy';

// Lazy so Leaflet + its CSS are a separate chunk, loaded only when an admin
// actually opens a map — never in the worker's initial bundle.
const StationMap = lazy(() =>
  import('./StationMap').then((module) => ({ default: module.StationMap })),
);

export function StationMapDialog({
  open,
  onOpenChange,
  stationName,
  station,
  completion,
  isFar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  station: Coordinates;
  completion: CapturedPosition | null;
  isFar: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={location.closeMap}>
        <DialogHeader>
          <DialogTitle>{location.mapTitle}</DialogTitle>
          <DialogDescription>{stationName}</DialogDescription>
        </DialogHeader>

        {/* Only mount the map (and thus load Leaflet) while the dialog is open. */}
        {open ? (
          <Suspense
            fallback={
              <div aria-busy="true" style={{ blockSize: 360 }}>
                <span className="sr-only">{states.loading}</span>
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            }
          >
            <StationMap station={station} completion={completion} isFar={isFar} />
          </Suspense>
        ) : null}

        {completion === null ? (
          <p className="text-small text-text-muted">{location.mapNoCompletion}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

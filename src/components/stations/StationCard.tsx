import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Check,
  Fuel,
  Mail,
  MapPin,
  MoreVertical,
  Navigation,
  Newspaper,
  Package,
  Pencil,
  StickyNote,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { actions, fields, labels, location, states } from '@/lib/copy';
import { cn } from '@/lib/utils';
import { distanceMeters } from '@/lib/geo';
import { formatDistance } from '@/lib/format';
import { StationMapDialog } from './StationMapDialog';
import type { Station } from '@/hooks/useStations';

/** Metres beyond which a completion is flagged as away from its station (§ location). */
const FAR_THRESHOLD_M = 500;

interface StationCardProps {
  station: Station;
  isNext: boolean;
  isAdmin: boolean;
  onComplete: () => void;
  onUncomplete: () => void;
  onNavigate: () => void;
  onToggleEnvelope: () => void;
  onToggleFlyers: () => void;
  onEdit: () => void;
}

export function StationCard({
  station,
  isNext,
  isAdmin,
  onComplete,
  onUncomplete,
  onNavigate,
  onToggleEnvelope,
  onToggleFlyers,
  onEdit,
}: StationCardProps) {
  const hasLocation = station.latitude !== null && station.longitude !== null;
  const isSuper = station.fuel_type === 'super';

  // Admin-only: how far the captured completion position is from the station's
  // own coordinates. Needs both points; distance is computed locally (the row
  // already carries both) rather than through completion_locations, which serves
  // the dashboard aggregate. Narrowed to non-null coords so no `!` is needed.
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
  const isFar =
    completionDistance !== null &&
    completionDistance - (station.completed_accuracy ?? 0) > FAR_THRESHOLD_M;

  // A completed station with known coordinates can be shown on a map — the
  // station's location and, when it was captured, where the worker stood.
  const canShowMap = isAdmin && station.is_done && stationCoords !== null;
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <article
      className={cn(
        'bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4',
        // Delivering רגיל to a סופר station is a wasted drive back. The fuel
        // type therefore gets a whole-card cue, not just a chip: a thick
        // inline-start edge that survives a thumb-flick down the list, when
        // the chip itself is moving too fast to read.
        //
        // `border-s-*` (logical), so it lands on the right-hand edge under
        // dir="rtl" — the edge the eye starts from.
        isSuper && 'border-s-danger border-s-4',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isNext ? <Badge variant="brand">{labels.next}</Badge> : null}
            <h3 className="text-h3 text-text">{station.name}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/*
              Fuel type stays a badge — it is a category, not a quantity — but
              the two states are deliberately NOT symmetrical. `רגיל` is the
              default and reads as a quiet annotation; `סופר` is the exception
              that costs a return trip if it is missed, so it takes the large
              size and the danger tint. The asymmetry is the signal: a worker
              scanning the list is looking for the one that stands out, not
              reading each label in turn.

              Both states keep a label AND an icon, so the distinction never
              rests on the colour (§6.2).
            */}
            <Badge variant={isSuper ? 'danger' : 'neutral'} size={isSuper ? 'lg' : 'sm'}>
              <Fuel className={isSuper ? 'size-5' : 'size-4'} aria-hidden />
              {isSuper ? fields.fuelSuper : fields.fuelRegular}
            </Badge>
          </div>

          {station.has_envelope || station.has_flyers_note ? (
            <div className="flex flex-wrap items-center gap-2">
              {station.has_envelope ? (
                <Badge variant="warning">
                  <Mail className="size-4" aria-hidden />
                  {labels.hasEnvelope}
                </Badge>
              ) : null}
              {station.has_flyers_note ? (
                <Badge variant="info">
                  <StickyNote className="size-4" aria-hidden />
                  {labels.hasFlyers}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {/* Who completed it is admin-only information (§8.5). */}
          {station.is_done && isAdmin && station.completed_at ? (
            <p className="text-caption text-text-muted">
              {labels.completedByAt(
                format(new Date(station.completed_at), 'd/M HH:mm', { locale: he }),
                station.completed_by_name ?? '—',
              )}
            </p>
          ) : null}

          {/* Distance of the captured completion from the station, and the way
              into the map (admin, § location). Tapping opens the station and
              completion points on a map. Colour never carries the "far" state
              alone — the pin icon and an explicit badge are there too. */}
          {canShowMap ? (
            <button
              type="button"
              onClick={() => {
                setMapOpen(true);
              }}
              className={cn(
                'text-caption flex flex-wrap items-center gap-1 text-start underline-offset-2 hover:underline',
                completionDistance !== null && isFar ? 'text-danger' : 'text-text-muted',
              )}
            >
              <MapPin className="size-4 shrink-0" aria-hidden />
              {completionDistance !== null ? (
                <>
                  <span className="ltr-isolate">{formatDistance(completionDistance)}</span>
                  {location.fromStation}
                </>
              ) : (
                location.showOnMap
              )}
              {completionDistance !== null && isFar ? (
                <Badge variant="danger">
                  <MapPin className="size-4" aria-hidden />
                  {location.farBadge}
                </Badge>
              ) : null}
            </button>
          ) : null}
        </div>

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/*
                An explicit menu replaces the original app's hidden double-tap
                and long-press gestures. Undiscoverable gestures are a defect.
              */}
              <Button variant="ghost" size="icon" aria-label={actions.openMenu}>
                <MoreVertical className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onToggleEnvelope}>
                <Mail className="size-5" aria-hidden />
                {actions.markEnvelope}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onToggleFlyers}>
                <StickyNote className="size-5" aria-hidden />
                {actions.markFlyers}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-5" aria-hidden />
                {actions.editStation}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {/*
        The two numbers the worker actually acts on at the pump, promoted out of
        the 13px badge row into the card's hero figures. Read at arm's length,
        one-handed, in sunlight — so the value carries the type weight and the
        word is the caption under it, not the other way round.
      */}
      <dl className="flex items-stretch gap-3">
        <Quantity
          icon={Package}
          label={fields.total}
          value={station.total}
          // Highlighted only when there is more than one to drop off, which is
          // the case worth noticing. Never colour alone — the icon and the
          // label are there in both states.
          emphasis={station.total > 1}
        />
        <Quantity icon={Newspaper} label={fields.flyers} value={station.flyers} />
      </dl>

      {station.is_done ? (
        <Button variant="outline" size="wide" onClick={onUncomplete}>
          <Undo2 className="size-5 rtl:-scale-x-100" aria-hidden />
          {actions.undoDone}
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button size="wide" onClick={onComplete} className="flex-1">
            <Check className="size-5" aria-hidden />
            {actions.markDone}
          </Button>

          <Button
            variant="outline"
            onClick={onNavigate}
            disabled={!hasLocation}
            // Disabled buttons are not hoverable, so the reason has to be on
            // the element itself for it to be reachable at all.
            title={hasLocation ? actions.navigate : states.noStationLocation}
            aria-label={hasLocation ? actions.navigate : states.noStationLocation}
          >
            <Navigation className="size-5" aria-hidden />
            {actions.navigate}
          </Button>
        </div>
      )}

      {canShowMap ? (
        <StationMapDialog
          open={mapOpen}
          onOpenChange={setMapOpen}
          stationName={station.name}
          station={stationCoords}
          completion={capturedCoords}
          isFar={isFar}
        />
      ) : null}
    </article>
  );
}

/**
 * One hero figure: a captioned number, sized to be read at a glance.
 *
 * `dt` before `dd` in the DOM so the term precedes its definition for a screen
 * reader; `flex-col-reverse` puts the number on top visually without reordering
 * the markup. `tabular-nums` keeps a two-digit value from jittering the block
 * width as a round progresses.
 */
function Quantity({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col-reverse items-center gap-1 rounded-md border px-3 py-2',
        emphasis ? 'border-warning bg-warning-bg' : 'border-border bg-surface-alt',
      )}
    >
      <dt
        className={cn(
          'text-caption flex items-center gap-1',
          emphasis ? 'text-warning' : 'text-text-muted',
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </dt>
      <dd className={cn('text-h1 tabular-nums', emphasis ? 'text-warning' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}

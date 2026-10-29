import { useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Fuel,
  Mail,
  MapPin,
  MoreVertical,
  Newspaper,
  Package,
  Pencil,
  StickyNote,
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
import { actions, fields, labels, location } from '@/lib/copy';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/format';
import { completionLocation } from './completion-location';
import { StationMapDialog } from './StationMapDialog';
import type { Station } from '@/hooks/useStations';

/**
 * The pieces the next-station card and the station row both draw. Kept here so
 * the two cannot drift: a סופר that reads one way in the hero and another in
 * the list is exactly the mismatch a worker scanning fast would miss.
 */

/**
 * Fuel type stays a badge — it is a category, not a quantity — but the two
 * states are deliberately NOT symmetrical. `רגיל` is the default and reads as a
 * quiet annotation; `סופר` is the exception that costs a return trip if it is
 * missed, so it takes the large size and the danger tint. The asymmetry is the
 * signal: a worker scanning the list is looking for the one that stands out,
 * not reading each label in turn.
 *
 * Both states keep a label AND an icon, so the distinction never rests on the
 * colour (§6.2).
 */
export function FuelBadge({ isSuper }: { isSuper: boolean }) {
  return (
    <Badge variant={isSuper ? 'danger' : 'neutral'} size={isSuper ? 'lg' : 'sm'}>
      <Fuel className={isSuper ? 'size-5' : 'size-4'} aria-hidden />
      {isSuper ? fields.fuelSuper : fields.fuelRegular}
    </Badge>
  );
}

export function MarkerBadges({ station }: { station: Station }) {
  return (
    <>
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
    </>
  );
}

/**
 * Who completed the station and where (admin only, §8.5 and § location).
 * Tapping the distance opens the station and completion points on a map.
 * Colour never carries the "far" state alone — the pin icon and an explicit
 * badge are there too.
 */
export function CompletionInfo({ station, isAdmin }: { station: Station; isAdmin: boolean }) {
  const { stationCoords, capturedCoords, completionDistance, isFar, canShowMap } =
    completionLocation(station, isAdmin);
  const [mapOpen, setMapOpen] = useState(false);

  const completedAt = station.is_done && isAdmin ? station.completed_at : null;
  if (completedAt === null && !canShowMap) return null;

  return (
    <>
      {completedAt !== null ? (
        <p className="text-caption text-text-muted">
          {labels.completedByAt(
            format(new Date(completedAt), 'd/M HH:mm', { locale: he }),
            station.completed_by_name ?? '—',
          )}
        </p>
      ) : null}

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

      {canShowMap && stationCoords !== null ? (
        <StationMapDialog
          open={mapOpen}
          onOpenChange={setMapOpen}
          stationName={station.name}
          station={stationCoords}
          completion={capturedCoords}
          isFar={isFar}
        />
      ) : null}
    </>
  );
}

/**
 * The two numbers the worker actually acts on at the pump, as hero figures.
 * Read at arm's length, one-handed, in sunlight — so the value carries the type
 * weight and the word is the caption under it, not the other way round.
 */
export function Quantities({ station }: { station: Station }) {
  return (
    <dl className="flex items-stretch gap-3">
      <Quantity
        icon={Package}
        label={fields.total}
        value={station.total}
        // Highlighted only when there is more than one to drop off, which is
        // the case worth noticing. Never colour alone — the icon and the label
        // are there in both states.
        emphasis={station.total > 1}
      />
      <Quantity icon={Newspaper} label={fields.flyers} value={station.flyers} />
    </dl>
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
        emphasis ? 'border-warning bg-warning-bg' : 'border-border bg-surface',
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

/**
 * The same two figures squeezed into a list row. The words are kept for a
 * screen reader; on screen the package and newspaper icons stand in for them,
 * as they do on the full card.
 */
export function CompactQuantities({ station }: { station: Station }) {
  const many = station.total > 1;
  return (
    <dl className="flex shrink-0 items-center gap-1">
      <div
        className={cn(
          'flex items-center gap-1 rounded-sm px-2 py-1',
          many ? 'bg-warning-bg text-warning' : 'text-text',
        )}
      >
        <dt>
          <Package className="size-4" aria-hidden />
          <span className="sr-only">{fields.total}</span>
        </dt>
        <dd className="text-h3 tabular-nums">{station.total}</dd>
      </div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-sm px-2 py-1',
          station.flyers > 0 ? 'text-text' : 'text-text-muted',
        )}
      >
        <dt>
          <Newspaper className="size-4" aria-hidden />
          <span className="sr-only">{fields.flyers}</span>
        </dt>
        <dd className="text-h3 tabular-nums">{station.flyers}</dd>
      </div>
    </dl>
  );
}

/**
 * An explicit menu replaces the original app's hidden double-tap and
 * long-press gestures. Undiscoverable gestures are a defect.
 */
export function StationAdminMenu({
  onToggleEnvelope,
  onToggleFlyers,
  onEdit,
  className,
}: {
  onToggleEnvelope: () => void;
  onToggleFlyers: () => void;
  onEdit: () => void;
  className?: string | undefined;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={actions.openMenu} className={className}>
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
  );
}

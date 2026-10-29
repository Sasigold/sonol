import { useId } from 'react';
import { Check, ChevronDown, Fuel, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { actions, fields, labels, states } from '@/lib/copy';
import { cn } from '@/lib/utils';
import {
  CompactQuantities,
  CompletionInfo,
  FuelBadge,
  MarkerBadges,
  Quantities,
  StationAdminMenu,
} from './station-parts';
import type { Station } from '@/hooks/useStations';

interface StationRowProps {
  station: Station;
  isNext: boolean;
  isAdmin: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onNavigate: () => void;
  onToggleEnvelope: () => void;
  onToggleFlyers: () => void;
  onEdit: () => void;
}

/**
 * One station as a single row: a check box, the name with the cues that change
 * what the worker does (סופר, envelope, flyers note), and the two quantities.
 * A tap on the row opens the rest — the full figures, navigation, and the admin
 * menu and completion details.
 *
 * The row is roughly a third of the height of the full card, so a phone shows
 * most of an area at once instead of two and a half stations.
 *
 * The check box opens the same confirm dialog as the card's button; it is not a
 * one-tap toggle. Its accessible name is the action it performs.
 */
export function StationRow({
  station,
  isNext,
  isAdmin,
  expanded,
  onToggleExpanded,
  onComplete,
  onUncomplete,
  onNavigate,
  onToggleEnvelope,
  onToggleFlyers,
  onEdit,
}: StationRowProps) {
  const detailsId = useId();
  const isSuper = station.fuel_type === 'super';
  const done = station.is_done;
  const hasLocation = station.latitude !== null && station.longitude !== null;
  const hasCues = isNext || isSuper || station.has_envelope || station.has_flyers_note;

  return (
    <article
      className={cn(
        'bg-surface border-border shadow-card rounded-lg border',
        // The same whole-row cue as the card — see StationCard.
        isSuper && !done && 'border-s-danger border-s-4',
      )}
    >
      {/* `relative` anchors the expand button's stretched hit area, so a tap
          anywhere on the row opens it; the check box sits above that layer. */}
      <div className="relative flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={done ? onUncomplete : onComplete}
          aria-label={done ? actions.undoDone : actions.markDone}
          className={cn(
            'relative z-10 flex size-12 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150',
            done
              ? 'bg-success border-success text-text-inverse'
              : 'border-border text-border hover:border-primary hover:text-primary',
          )}
        >
          <Check className="size-6" aria-hidden />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className={cn('text-h3 break-words', done ? 'text-text-muted' : 'text-text')}>
            {station.name}
          </h3>

          {hasCues && !done ? (
            <div className="flex flex-wrap items-center gap-1">
              {isNext ? <Badge variant="brand">{labels.next}</Badge> : null}
              {/* Only סופר is called out in the row; רגיל is the default and
                  the expanded details name it. The row keeps the red edge
                  as well, so the cue is never the chip alone. */}
              {isSuper ? (
                <Badge variant="danger">
                  <Fuel className="size-4" aria-hidden />
                  {fields.fuelSuper}
                </Badge>
              ) : null}
              <MarkerBadges station={station} />
            </div>
          ) : null}
        </div>

        <CompactQuantities station={station} />

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={actions.stationDetails}
          className="text-text-muted flex shrink-0 items-center after:absolute after:inset-0 after:rounded-lg"
        >
          <ChevronDown
            className={cn(
              'size-5 transition-transform duration-150 motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </div>

      {expanded ? (
        <div id={detailsId} className="border-border flex flex-col gap-3 border-t p-4">
          {/* The collapsed row already shows סופר and the markers on an
              outstanding station; repeat only what it left out — רגיל, and
              everything on a done row, which shows no cues. */}
          {done || !isSuper ? (
            <div className="flex flex-wrap items-center gap-2">
              <FuelBadge isSuper={isSuper} />
              {done ? <MarkerBadges station={station} /> : null}
            </div>
          ) : null}

          <CompletionInfo station={station} isAdmin={isAdmin} />

          <Quantities station={station} />

          {!done || isAdmin ? (
            <div className="flex gap-3">
              {!done ? (
                <Button
                  variant="outline"
                  size="wide"
                  onClick={onNavigate}
                  disabled={!hasLocation}
                  className="flex-1"
                  title={hasLocation ? actions.navigate : states.noStationLocation}
                  aria-label={hasLocation ? actions.navigate : states.noStationLocation}
                >
                  <Navigation className="size-5" aria-hidden />
                  {actions.navigate}
                </Button>
              ) : null}
              {isAdmin ? (
                <StationAdminMenu
                  onToggleEnvelope={onToggleEnvelope}
                  onToggleFlyers={onToggleFlyers}
                  onEdit={onEdit}
                  className="ms-auto"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

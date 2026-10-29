import { Check, Navigation, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actions, labels, states } from '@/lib/copy';
import { cn } from '@/lib/utils';
import {
  CompletionInfo,
  FuelBadge,
  MarkerBadges,
  Quantities,
  StationAdminMenu,
} from './station-parts';
import type { Station } from '@/hooks/useStations';

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

/**
 * The full station card — on the stations screen, the next station only.
 *
 * A worker in a vehicle does one station at a time, so the one they are
 * driving to is lifted out of the list into a card in the brand colour, with
 * both actions at full width at the top of the screen. Everything after it is
 * a compact `StationRow`. When it is marked done the next one takes its place,
 * so the action the worker wants is always in the same spot.
 *
 * A completed station drops the brand fill: it is no longer the thing to act on.
 */
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
  const featured = !station.is_done;

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-lg border p-4',
        // The raw brand navy in BOTH themes, not `bg-primary`: in dark mode
        // `--primary` is the light tint, and a pale block at the top of the
        // screen is glare in a cab at night.
        featured
          ? 'bg-brand-800 text-primary-foreground border-brand-800 shadow-raised dark:text-text'
          : 'bg-surface text-text border-border shadow-card',
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
          {isNext ? <p className="text-caption">{labels.nextStation}</p> : null}
          <h3 className="text-h1">{station.name}</h3>

          <div className="flex flex-wrap items-center gap-2">
            <FuelBadge isSuper={isSuper} />
            <MarkerBadges station={station} />
          </div>

          <CompletionInfo station={station} isAdmin={isAdmin} />
        </div>

        {isAdmin ? (
          <StationAdminMenu
            onToggleEnvelope={onToggleEnvelope}
            onToggleFlyers={onToggleFlyers}
            onEdit={onEdit}
            className={cn(featured && 'text-primary-foreground hover:bg-brand-700 dark:text-text')}
          />
        ) : null}
      </header>

      <Quantities station={station} />

      {station.is_done ? (
        <Button variant="outline" size="wide" onClick={onUncomplete}>
          <Undo2 className="size-5 rtl:-scale-x-100" aria-hidden />
          {actions.undoDone}
        </Button>
      ) : (
        <div className="flex gap-3">
          {/* Inverted on the brand fill: the one light block on a dark card is
              where the eye — and the thumb — lands first. */}
          <Button
            size="wide"
            onClick={onComplete}
            className="bg-surface text-text hover:bg-surface-alt dark:bg-brand-300 dark:text-text-inverse dark:hover:bg-brand-400 flex-1"
          >
            <Check className="size-5" aria-hidden />
            {actions.markDone}
          </Button>

          <Button
            variant="outline"
            onClick={onNavigate}
            disabled={!hasLocation}
            className="border-primary-foreground text-primary-foreground dark:border-text dark:text-text hover:bg-brand-700 bg-transparent"
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
    </article>
  );
}

import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Check,
  Fuel,
  Mail,
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
import { actions, fields, labels, states } from '@/lib/copy';
import { cn } from '@/lib/utils';
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

  return (
    <article className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isNext ? <Badge variant="brand">{labels.next}</Badge> : null}
            <h3 className="text-h3 text-text">{station.name}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Fuel type: regular is neutral, super is a subtle danger badge.
                It stays a badge — it is a category, not a quantity. */}
            <Badge variant={station.fuel_type === 'super' ? 'danger' : 'neutral'}>
              <Fuel className="size-4" aria-hidden />
              {station.fuel_type === 'super' ? fields.fuelSuper : fields.fuelRegular}
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

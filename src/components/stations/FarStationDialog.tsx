import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { actions, dialogs } from '@/lib/copy';
import { formatDistance } from '@/lib/format';

interface FarStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  /** Distance from the station, in metres, shown as the hero figure. */
  meters: number;
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * The distance warning, deliberately built as its own screen rather than routed
 * through `ConfirmDialog` — the whole point is that it does NOT look like the
 * routine "did you do it?" confirm.
 *
 * A big danger banner: a 48px alert triangle (the largest the spacing scale
 * allows), the distance as a `text-display` hero figure, and the whole card
 * tinted with the danger tokens. A worker one-handed in sunlight reads it as a
 * stop-and-check, not a tap-through. Colour never carries it alone (§6.2) — the
 * icon, the title and the explicit distance all say "far" without the red.
 *
 * It stays a warning, never a block: the override button confirms the
 * completion anyway, and cancel (with no side effect, like `ConfirmDialog`)
 * backs out so the worker can go check where they are.
 */
export function FarStationDialog({
  open,
  onOpenChange,
  stationName,
  meters,
  pending = false,
  onConfirm,
}: FarStationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="items-center text-center">
        <AlertDialogHeader className="items-center gap-3">
          <span
            className="bg-danger-bg text-danger flex size-12 items-center justify-center rounded-full"
            aria-hidden
          >
            <AlertTriangle className="size-8" />
          </span>
          <AlertDialogTitle className="text-h1 text-danger">
            {dialogs.farStation.title}
          </AlertDialogTitle>
          {/* The distance as the hero figure — its own line, bidi-isolated, in
              the largest type the scale carries. */}
          <p className="text-display text-danger tabular-nums">
            <bdi>{formatDistance(meters)}</bdi>
          </p>
          <AlertDialogDescription className="text-body text-text">
            {dialogs.farStation.body(stationName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="w-full">
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog mounted while the mutation runs so pending shows;
              // the caller closes it on settle.
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="bg-danger text-text-inverse hover:opacity-90"
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {dialogs.farStation.confirm}
          </AlertDialogAction>
          <AlertDialogCancel disabled={pending}>{actions.cancel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

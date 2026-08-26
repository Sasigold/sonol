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
import { actions } from '@/lib/copy';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names what is affected — every destructive action must (brief §3, rule 8). */
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * `warning` marks a "did you mean to?" prompt — an unusual-but-allowed action,
   * not a destructive one — with an alert icon and a warning-tinted title, so a
   * worker glancing at it one-handed reads it as a caution and not a routine
   * confirm. It leaves the confirm button alone (the action is not destructive);
   * `destructive` is the separate, redder treatment for an irreversible one.
   */
  tone?: 'default' | 'warning';
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * Defect 10 of the original app: "Cancel" in the navigation-warning dialog
 * called `pop()` and threw the user out of the screen entirely.
 *
 * There is deliberately NO `onCancel` prop. Cancel closes the dialog and does
 * nothing else — not by convention, but because there is no way to attach
 * behaviour to it. Reintroducing the defect would require editing this file.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = actions.confirm,
  cancelLabel = actions.cancel,
  destructive = false,
  tone = 'default',
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn('flex items-center gap-2', tone === 'warning' && 'text-warning')}
          >
            {tone === 'warning' ? <AlertTriangle className="size-5 shrink-0" aria-hidden /> : null}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog mounted while the mutation runs so the pending
              // state is visible; the caller closes it on settle.
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={cn(destructive && 'bg-danger text-text-inverse hover:opacity-90')}
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

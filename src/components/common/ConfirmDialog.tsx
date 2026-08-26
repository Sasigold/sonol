import { Loader2 } from 'lucide-react';
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
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
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

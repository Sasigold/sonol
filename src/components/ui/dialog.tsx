import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { actions } from '@/lib/copy';

/**
 * Plain Dialog (not AlertDialog) for non-destructive, dismissible content — the
 * completion-location map. AlertDialog is reserved for destructive
 * confirmations (traps focus, no outside-click dismiss). This one closes on
 * overlay click and Escape and carries an explicit close button.
 *
 * Direction: Radix Dialog centres its content via inset + margin auto (see
 * DialogContent) and has no direction-aware positioning to stamp, so — like
 * AlertDialog — it needs no `dir` pin; the app's DirectionProvider covers any
 * descendant primitive.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  closeLabel = actions.cancel,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        // Centred via inset + margin auto rather than `start-1/2 -translate`,
        // which would be wrong under RTL.
        className={cn(
          'bg-surface border-border shadow-overlay fixed inset-x-0 top-1/2 z-50 mx-auto flex w-full max-w-lg -translate-y-1/2 flex-col gap-4 rounded-lg border p-6',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          // Logical inset-inline-end so it lands on the left under RTL.
          className="text-text-muted hover:text-text absolute end-4 top-4 flex size-8 items-center justify-center rounded-sm"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-h2 text-text', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body text-text-muted', className)}
      {...props}
    />
  );
}

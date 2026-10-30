import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

/**
 * AlertDialog rather than Dialog for destructive confirmations: it traps focus,
 * has no dismiss-on-outside-click, and is announced as `alertdialog`. Every
 * destructive action in this app is gated behind one (brief §3, rule 8).
 */
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
      <AlertDialogPrimitive.Content
        // `start-1/2 -translate-x-1/2` would be wrong under RTL; centring via
        // inset + margin auto is direction-agnostic.
        className={cn(
          'fx-panel bg-surface border-border shadow-overlay data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out fixed inset-x-0 top-1/2 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-md -translate-y-1/2 flex-col gap-4 rounded-lg border p-6',
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    // Column-reverse on narrow screens puts the confirming action nearest the
    // thumb without changing DOM order, so the tab order stays logical.
    <div
      className={cn('flex flex-col-reverse gap-3 sm:flex-row sm:justify-start', className)}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn('text-h2 text-text', className)} {...props} />;
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-body text-text-muted', className)}
      {...props}
    />
  );
}

/**
 * `variant`, not a colour override: the primary variant paints a gradient
 * image that a `bg-danger` class would leave showing on top.
 */
export function AlertDialogAction({
  className,
  variant = 'primary',
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & {
  variant?: 'primary' | 'destructive';
}) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  );
}

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Direction is PINNED here, not inherited from the document.
 *
 * Radix resolves direction from a `DirectionProvider` and silently falls back
 * to `'ltr'` when there is none — then writes it out as a real `dir` attribute
 * on the menu content. The content is portalled to `<body>`, so that attribute
 * overrides the `dir="rtl"` on `<html>` instead of inheriting it: a Hebrew menu
 * laid out left-to-right, with each item's icon on the wrong side of its label.
 * `align="end"` was measured from the wrong edge too — floating-ui reads the
 * computed direction of the element it is positioning, which was the `ltr` one.
 *
 * `dir` is omitted from the props type on purpose, and applied after the
 * spread. This app has no LTR mode; a call site must not be able to open one.
 */
export function DropdownMenu(
  props: Omit<ComponentProps<typeof DropdownMenuPrimitive.Root>, 'dir'>,
) {
  return <DropdownMenuPrimitive.Root {...props} dir="rtl" />;
}

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // min-w-max, not a fixed step: the spacing scale stops at 48px, and
          // sizing to the longest item is the right behaviour anyway.
          'bg-surface border-border shadow-overlay z-50 min-w-max overflow-hidden rounded-md border p-1',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        // h-12: this is an explicit replacement for the original app's hidden
        // double-tap and long-press gestures, so it has to be a real target.
        'text-body text-text hover:bg-surface-alt flex h-12 cursor-pointer items-center gap-3 rounded-sm px-3 outline-none',
        'data-[highlighted]:bg-surface-alt data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator className={cn('bg-border my-1 h-px', className)} {...props} />
  );
}

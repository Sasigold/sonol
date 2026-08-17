import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Direction is PINNED here — see the note on `DropdownMenu`.
 *
 * Select is the worse of the two: Radix stamps its resolved direction onto the
 * TRIGGER as well as the portalled content. Left at the `'ltr'` fallback, the
 * trigger's `justify-between` put the chevron on the right and the Hebrew area
 * name on the left, inside a form that is otherwise right-aligned.
 */
export function Select(props: Omit<ComponentProps<typeof SelectPrimitive.Root>, 'dir'>) {
  return <SelectPrimitive.Root {...props} dir="rtl" />;
}

export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'border-border bg-surface text-text text-body flex h-12 w-full items-center justify-between gap-2 rounded-md border px-4',
        'aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="text-text-muted size-5 shrink-0" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          // Radix measures the space available; a fixed step would either
          // overflow small screens or waste large ones.
          'bg-surface border-border shadow-overlay z-50 max-h-[--radix-select-content-available-height] min-w-max overflow-hidden rounded-md border',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'text-body text-text data-[highlighted]:bg-surface-alt flex h-12 cursor-pointer items-center gap-2 rounded-sm px-3 outline-none',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator>
        <Check className="text-primary size-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

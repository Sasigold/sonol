import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Direction is PINNED here — see the note on `DropdownMenu`.
 *
 * Tabs was the widest-reaching of the three: Radix writes the resolved
 * direction onto the Tabs ROOT div, and in `AreaPage` that root wraps both the
 * tab bar and every station card under it. At the `'ltr'` fallback the entire
 * station list — the screen a field worker spends the round on — rendered
 * left-to-right inside an otherwise RTL page.
 *
 * It also decides which arrow key moves which way: roving focus mirrors
 * ArrowLeft/ArrowRight under `rtl`, so the tab bar now walks the way it looks.
 */
export function Tabs(props: Omit<ComponentProps<typeof TabsPrimitive.Root>, 'dir'>) {
  return <TabsPrimitive.Root {...props} dir="rtl" />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('bg-surface-alt flex w-full gap-1 rounded-md p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'text-body-strong text-text-muted flex h-12 flex-1 items-center justify-center rounded-sm transition-colors',
        'data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4', className)} {...props} />;
}

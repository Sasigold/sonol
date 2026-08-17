import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'border-border data-[state=checked]:bg-success data-[state=unchecked]:bg-surface-alt relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        // `translate-x` is physical, but the thumb travel must follow the
        // TRACK, which does not mirror — the switch is a control, not text.
        // Radix flips the track under dir=rtl, so the thumb follows it.
        className="bg-surface shadow-card pointer-events-none block size-5 rounded-full transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

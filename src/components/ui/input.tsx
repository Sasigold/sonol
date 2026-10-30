import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Body text is 16px on purpose: iOS Safari zooms the viewport when a focused
 * input is smaller than that, which is disorienting one-handed in a vehicle.
 */
export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'border-border bg-surface text-text placeholder:text-text-muted text-body shadow-card h-12 w-full rounded-md border px-4 transition',
        // The field lights up while it has the cursor. The neon border alone
        // holds 3:1 against the surface, so the glow is extra, not the signal.
        'focus-visible:border-neon focus-visible:shadow-glow focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

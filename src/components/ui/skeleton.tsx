import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Loading is a skeleton, never a spinner (brief §3, rule 6): a skeleton shows
 * the shape of what is coming, which reads faster in bright sunlight than an
 * indeterminate spinner.
 *
 * `animate-pulse` is suppressed by the `prefers-reduced-motion` rule in the
 * base layer.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('bg-surface-alt animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

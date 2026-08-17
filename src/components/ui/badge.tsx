import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Colour never carries meaning alone (§6.2) — every variant here is used with
 * an icon or a text label, never as a bare coloured dot.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-alt text-text-muted',
        // `סופר` is a subtle badge, never a full red block (§6.2).
        danger: 'bg-danger-bg text-danger',
        warning: 'bg-warning-bg text-warning',
        info: 'bg-info-bg text-info',
        success: 'bg-success-bg text-success',
        brand: 'bg-brand-100 text-brand-800',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

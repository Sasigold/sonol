import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Colour never carries meaning alone (§6.2) — every variant here is used with
 * an icon or a text label, never as a bare coloured dot.
 */
const badgeVariants = cva('inline-flex items-center rounded-full whitespace-nowrap', {
  variants: {
    variant: {
      neutral: 'bg-surface-alt text-text-muted',
      // Still not a full red block (§6.2) — the tint stays on the chip and
      // never floods the card. `lg` is what carries `סופר`; see StationCard.
      danger: 'bg-danger-bg text-danger',
      warning: 'bg-warning-bg text-warning',
      info: 'bg-info-bg text-info',
      success: 'bg-success-bg text-success',
      brand: 'bg-brand-100 text-brand-800',
    },
    size: {
      /** The default. A quiet annotation beside something else. */
      sm: 'gap-1 px-2 py-1 text-caption',
      /** For a fact that must survive a glance at arm's length in sunlight. */
      lg: 'gap-2 px-3 py-1 text-body-strong',
    },
  },
  defaultVariants: { variant: 'neutral', size: 'sm' },
});

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

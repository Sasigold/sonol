import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Written by hand rather than pulled from the shadcn CLI.
 *
 * shadcn's button ships `h-9` / `h-8` / `shadow-xs`, and none of those exist in
 * our token scale — a missing Tailwind utility fails silently, so it would have
 * looked "fine" while being unstyled. Separately, the brief's 48x48 touch-target
 * floor is larger than every shadcn size variant, so each one would have been
 * rewritten on arrival anyway.
 *
 * There is deliberately NO size below 48px: the constraint is enforced by not
 * offering the option.
 */
/*
 * The press is felt, not just seen: every variant sinks 2% under the thumb.
 * In a vehicle the tap itself is uncertain, and the scale is the
 * acknowledgement that it landed — it is state feedback, not decoration.
 *
 * `primary` paints a gradient over its flat colour. A gradient is a background
 * IMAGE, which a later `bg-danger` would not remove — so a destructive button
 * must ask for the `destructive` variant, never override `primary`'s colour.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-body-strong whitespace-nowrap transition select-none active:scale-98 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary bg-(image:--grad-primary) text-primary-foreground shadow-raised hover:bg-(image:--grad-primary-hover)',
        secondary: 'bg-surface-alt text-text hover:bg-border',
        outline: 'border border-border bg-surface text-text hover:border-neon hover:bg-surface-alt',
        ghost: 'text-text hover:bg-surface-alt',
        destructive: 'bg-danger text-text-inverse shadow-raised hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5',
        wide: 'h-12 w-full px-6',
        icon: 'size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the child element (Radix Slot) — e.g. to make a Link look like a button. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };

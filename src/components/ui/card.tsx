import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Cards use radius `lg` (16px) per the design system. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-surface border-border shadow-card rounded-lg border', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-h1 text-text', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-small text-text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />;
}

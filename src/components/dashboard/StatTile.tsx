import type { LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/fx/AnimatedNumber';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: number | string;
  icon?: LucideIcon | undefined;
  tone?: 'default' | 'success' | 'warning' | undefined;
  className?: string | undefined;
}

/**
 * A hero number, not a chart: two values with no comparison to make and no
 * trend to show. Adding a plot here would be decoration.
 */
export function StatTile({ label, value, icon: Icon, tone = 'default', className }: StatTileProps) {
  return (
    <div
      className={cn(
        'fx-panel bg-surface border-border shadow-card relative flex flex-col gap-2 rounded-lg border p-4',
        className,
      )}
    >
      <span className="text-small text-text-muted flex items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full',
              tone === 'success' && 'bg-success-bg text-success',
              tone === 'warning' && 'bg-warning-bg text-warning',
              tone === 'default' && 'bg-neon-bg text-neon-strong',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        {label}
      </span>
      <span
        className={cn(
          'text-display font-extrabold tracking-tight',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-text',
        )}
      >
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </span>
    </div>
  );
}

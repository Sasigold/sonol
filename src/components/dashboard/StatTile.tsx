import type { LucideIcon } from 'lucide-react';
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
        'bg-surface border-border shadow-card flex flex-col gap-1 rounded-lg border p-4',
        className,
      )}
    >
      <span className="text-small text-text-muted flex items-center gap-2">
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {label}
      </span>
      <span
        className={cn(
          'text-display',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-text',
        )}
      >
        {value}
      </span>
    </div>
  );
}

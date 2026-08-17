import { Shield, User } from 'lucide-react';
import { fields } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Colour never carries meaning alone (brief §6.2) — the badge always pairs its
 * colour with an icon and a text label, so it survives greyscale, sunlight and
 * colour blindness.
 */
export function RoleBadge({ isAdmin, className }: { isAdmin: boolean; className?: string }) {
  const Icon = isAdmin ? Shield : User;
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-full px-3 py-1',
        isAdmin ? 'bg-brand-100 text-brand-800' : 'bg-surface-alt text-text-muted',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {isAdmin ? fields.admin : fields.worker}
    </span>
  );
}

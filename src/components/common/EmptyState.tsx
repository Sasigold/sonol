import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

/**
 * Optional props are declared `?: T | undefined`, not bare `?: T`. Under
 * `exactOptionalPropertyTypes` the bare form rejects any caller passing a
 * possibly-undefined value — which is most of them.
 */
interface EmptyStateProps {
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}

/**
 * Defect 18: an empty state in the original rendered `Image.asset('')` — a
 * broken image icon. This one is drawn, not loaded, so it cannot 404.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="bg-surface-alt text-text-muted flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-h3 text-text">{title}</p>
        {description ? <p className="text-small text-text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

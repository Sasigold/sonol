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
      {/* A beacon: the icon in a lit orb inside two radar rings. */}
      <span className="relative my-4 flex size-12 items-center justify-center" aria-hidden>
        <span className="border-neon/30 absolute -inset-3 rounded-full border" />
        <span className="border-neon/15 absolute -inset-6 rounded-full border" />
        <span className="bg-neon-bg text-neon-strong shadow-glow relative flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" />
        </span>
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-h3 text-text">{title}</p>
        {description ? <p className="text-small text-text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

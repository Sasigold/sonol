import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { states } from '@/lib/copy';

interface ErrorStateProps {
  title?: string | undefined;
  description?: string | undefined;
  onRetry?: (() => void) | undefined;
}

/**
 * One of the four states every screen must have (brief §3, rule 6):
 * message plus retry, never a dead end.
 */
export function ErrorState({
  title = states.loadError.title,
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="relative my-4 flex size-12 items-center justify-center" aria-hidden>
        <span className="border-danger/30 absolute -inset-3 rounded-full border" />
        <span className="border-danger/15 absolute -inset-6 rounded-full border" />
        <span className="bg-danger-bg text-danger relative flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-6" />
        </span>
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-h3 text-text">{title}</p>
        {description ? <p className="text-small text-text-muted">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {states.loadError.retry}
        </Button>
      ) : null}
    </div>
  );
}

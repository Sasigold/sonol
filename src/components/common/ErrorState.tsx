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
      <span className="bg-danger-bg text-danger flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden />
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

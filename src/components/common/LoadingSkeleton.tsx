import { Skeleton } from '@/components/ui/skeleton';
import { states } from '@/lib/copy';

/**
 * Full-page loading used by the route guards while the session is being
 * restored. It must NOT look like the sign-in screen: a flash of "please sign
 * in" for an already-signed-in user is exactly the confusion the auth state
 * machine exists to prevent.
 *
 * Blocks are built by stacking scale-legal heights rather than reaching for an
 * arbitrary one — the spacing scale tops out at 48px by design.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-6 p-4" aria-busy="true">
      <span className="sr-only">{states.loading}</span>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="size-12 rounded-md" />
      </div>

      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

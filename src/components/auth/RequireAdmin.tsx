import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useAuth } from '@/contexts/auth-context';
import { app } from '@/lib/copy';

/**
 * Admin-only routes (brief §7). Sits INSIDE <RequireAuth>, so by the time it
 * renders the session and profile are already known — it only has to answer
 * "is this an admin".
 *
 * Defect 7 of the original app: admin routes had no guard at all and were
 * reachable by typing the URL. Note this is a convenience, not the security
 * boundary — RLS and the RPCs refuse the same operations server-side even if
 * someone bypasses this.
 */
export function RequireAdmin() {
  const { state } = useAuth();
  const isAdmin = state.status === 'signedIn' && state.profile.is_admin;
  const shouldWarn = state.status === 'signedIn' && !state.profile.is_admin;

  // Fires once per rejection rather than on every re-render, and outside the
  // render pass so it never warns during an interrupted render.
  const warned = useRef(false);
  useEffect(() => {
    if (shouldWarn && !warned.current) {
      warned.current = true;
      toast.error(app.adminOnly);
    }
  }, [shouldWarn]);

  if (state.status !== 'signedIn') return <PageLoadingSkeleton />;

  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

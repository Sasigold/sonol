import { Navigate, Outlet } from 'react-router-dom';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { isAuthorized, useAuth } from '@/contexts/auth-context';

/**
 * Guard for every signed-in route (brief §7).
 *
 * The `loading` branch is the important one: returning a redirect there would
 * bounce an already-signed-in user to /signin on first paint, before the
 * session has been read back from storage. It renders a skeleton instead and
 * decides nothing until the state is actually known.
 *
 * Every redirect uses `replace`, so the back button cannot re-enter a stale
 * state.
 */
export function RequireAuth() {
  const { state, refresh } = useAuth();

  switch (state.status) {
    case 'loading':
      return <PageLoadingSkeleton />;

    case 'error':
      return (
        <ErrorState
          description={state.message}
          onRetry={() => {
            void refresh();
          }}
        />
      );

    case 'signedOut':
      return <Navigate to="/signin" replace />;

    case 'signedIn':
      return isAuthorized(state.profile) ? <Outlet /> : <Navigate to="/blocked" replace />;
  }
}

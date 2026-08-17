import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAuthorized, useAuth } from '@/contexts/auth-context';
import { actions, blocked } from '@/lib/copy';

/**
 * Defect 6 of the original app: the lockout screen did not sign the user out
 * and could be escaped with the browser back button.
 *
 * This route is deliberately PUBLIC — outside <RequireAuth>. If it were
 * guarded, signing out on mount would immediately fail the guard's session
 * check and redirect to /signin before the message could be read. The guard
 * sends unauthorized users *here*; the route itself guards nothing.
 *
 * Nothing rendered below depends on session state, so the message survives its
 * own sign-out.
 */
export function BlockedPage() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const signedOutOnce = useRef(false);

  const authorized = state.status === 'signedIn' && isAuthorized(state.profile);

  useEffect(() => {
    // Do not sign out someone who simply typed the URL while authorized —
    // they get redirected below instead.
    if (authorized || signedOutOnce.current) return;
    if (state.status === 'loading') return;
    signedOutOnce.current = true;
    void signOut();
  }, [authorized, state.status, signOut]);

  if (authorized) return <Navigate to="/" replace />;

  return (
    <div className="bg-brand-800 flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="bg-brand-700 text-text-inverse flex size-12 items-center justify-center rounded-full">
        <Lock className="size-6" aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-display text-text-inverse">{blocked.title}</h1>
        <p className="text-body text-text-inverse/80">{blocked.body}</p>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          // `replace` so the guarded URL that sent the user here is gone from
          // history and Back cannot return to it.
          navigate('/signin', { replace: true });
        }}
      >
        {actions.backToSignIn}
      </Button>
    </div>
  );
}

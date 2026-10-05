import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { hideSplash } from '@/lib/splash';

/**
 * Lifts the boot splash (index.html) the moment the session is known — signed
 * in, signed out or failed alike. Renders nothing.
 */
export function SplashRelease() {
  const { state } = useAuth();
  const ready = state.status !== 'loading';

  useEffect(() => {
    if (ready) hideSplash();
  }, [ready]);

  return null;
}

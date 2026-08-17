import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { greeting } from '@/lib/format';
import { labels } from '@/lib/copy';

/**
 * Placeholder. Phase 3 replaces this with the real area list read from the
 * `my_areas` view. The greeting is here already because it is pure logic with
 * its own unit tests, and it proves the profile actually reached the screen.
 */
export function HomePage() {
  const { state } = useAuth();
  const name = state.status === 'signedIn' ? state.profile.display_name : '';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 text-text">
        {greeting()}
        {name ? `, ${name}` : ''}
      </h1>

      <Card>
        <CardContent className="p-6">
          <p className="text-body text-text-muted">{labels.roundProgress(0, 0)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

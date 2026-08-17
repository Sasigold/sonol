import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { app, nav } from '@/lib/copy';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-display text-text-muted">404</p>
      <h1 className="text-h1 text-text">{app.notFound}</h1>
      <Button asChild variant="outline">
        <Link to="/">{nav.home}</Link>
      </Button>
    </div>
  );
}

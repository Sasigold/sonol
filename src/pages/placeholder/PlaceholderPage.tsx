import { Card, CardContent } from '@/components/ui/card';

/**
 * Stand-in for the admin screens until phases 4-5 build them. It exists so the
 * route tree and the role guards can be exercised end to end now.
 *
 * The heading comes from the caller, which passes a string out of copy.ts —
 * this component holds no Hebrew of its own.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 text-text">{title}</h1>
      <Card>
        <CardContent className="p-6">
          <p className="text-body text-text-muted">···</p>
        </CardContent>
      </Card>
    </div>
  );
}

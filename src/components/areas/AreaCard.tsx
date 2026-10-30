import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { ProgressRing } from '@/components/common/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { celebrate, labels } from '@/lib/copy';
import { cn } from '@/lib/utils';
import type { MyArea } from '@/hooks/useAreas';

export function AreaCard({ area }: { area: MyArea }) {
  const remaining = area.remaining_count ?? 0;
  const done = area.done_count ?? 0;
  const total = area.station_count ?? 0;
  const complete = total > 0 && remaining === 0;

  return (
    <Link
      to={`/areas/${area.area_id ?? ''}`}
      className={cn(
        'fx-panel bg-surface border-border shadow-card hover:border-neon/50 hover:shadow-raised relative flex items-center gap-4 rounded-lg border p-4 transition active:scale-98',
        complete && 'border-success/40',
      )}
    >
      <ProgressRing done={done} total={total} />

      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="text-h3 text-text truncate">{area.area_name}</span>
        {complete ? (
          <Badge variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            {celebrate.areaComplete}
          </Badge>
        ) : (
          <span className="text-small text-text-muted">{labels.remaining(remaining)}</span>
        )}
      </span>

      {/* A left chevron points the wrong way in RTL — mirror it. */}
      <ChevronLeft className="text-text-muted size-5 shrink-0 rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}
